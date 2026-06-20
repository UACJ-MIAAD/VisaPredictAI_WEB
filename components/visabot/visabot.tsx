"use client";

import * as React from "react";
import {
  Sparkles, X, Send, Square, Plus, Copy, Check, ArrowDown, Mic,
  Volume2, Loader2, BookOpen,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { Markdown } from "./markdown";
import { retrieve, generate, warmUp, isModelReady } from "./engine";
import type { ChatMessage, Source } from "./types";

// ── lightweight SpeechRecognition typing (Web Speech API) ───────────────────
type SR = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: { 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VisaBot() {
  const { lang } = useLang();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [ready, setReady] = React.useState(false); // semantic model ready
  const [copied, setCopied] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [listening, setListening] = React.useState(false);
  // computed after mount only — avoids SSR/client hydration mismatch (window
  // is undefined on the server, so this must not affect the first render).
  const [hasSR, setHasSR] = React.useState(false);
  React.useEffect(() => setHasSR(!!getSR()), []);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const wasOpen = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const recRef = React.useRef<SR | null>(null);

  // ── open: warm up engine, load suggestions, focus input ───────────────────
  React.useEffect(() => {
    if (!open) return;
    warmUp();
    track("VisaBot Open", { lang });
    fetch("/rag/suggestions.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSuggestions(d[lang] || []))
      .catch(() => {});
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    // poll model readiness for the status pill
    const iv = setInterval(() => {
      if (isModelReady()) {
        setReady(true);
        clearInterval(iv);
      }
    }, 600);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [open, lang]);

  // ── return focus to the launcher when the panel closes (a11y) ─────────────
  React.useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) launcherRef.current?.focus();
  }, [open]);

  // ── Esc to close · basic focus trap ───────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>(
        'button,textarea,a[href],[tabindex]:not([tabindex="-1"])',
      );
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  // ── autoscroll on new content if pinned to bottom ─────────────────────────
  React.useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  // ── send ──────────────────────────────────────────────────────────────────
  const send = React.useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      setBusy(true);
      track("VisaBot Query", { lang });
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

      let sources: Source[] = [];
      try {
        sources = await retrieve(q, lang, 6);
      } catch {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: tr(lang, "vbNoIndex") };
          return c;
        });
        setBusy(false);
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await generate(
          q,
          history,
          sources,
          lang,
          (delta) =>
            setMessages((m) => {
              const c = [...m];
              const last = c[c.length - 1];
              c[c.length - 1] = { ...last, content: last.content + delta };
              return c;
            }),
          ctrl.signal,
        );
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = {
            role: "assistant",
            content: res.text,
            sources,
            extractive: res.extractive,
          };
          return c;
        });
        if (res.extractive) track("VisaBot Fallback", { lang });
      } catch {
        setMessages((m) => {
          const c = [...m];
          const last = c[c.length - 1];
          c[c.length - 1] = { ...last, content: last.content || tr(lang, "vbError") };
          return c;
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, lang, messages],
  );

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const newChat = () => {
    stop();
    setMessages([]);
    inputRef.current?.focus();
  };

  const copy = (i: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600);
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\[[\d]+\]/g, "").replace(/[#*_`>]/g, ""));
    u.lang = lang === "en" ? "en-US" : "es-MX";
    window.speechSynthesis.speak(u);
    track("VisaBot Speak", { lang });
  };

  const toggleMic = () => {
    const Rec = getSR();
    if (!Rec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = new Rec();
    recRef.current = r;
    r.lang = lang === "en" ? "en-US" : "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const txt = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join("");
      setInput(txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    setListening(true);
    track("VisaBot Voice", { lang });
  };

  const statusLabel = ready
    ? tr(lang, "vbEngineReady")
    : open
      ? tr(lang, "vbLoadingEngine")
      : "";

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          ref={launcherRef}
          onClick={() => setOpen(true)}
          aria-label={tr(lang, "vbOpen")}
          className="vb-launcher group fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-3 text-white shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          style={{ boxShadow: "0 8px 30px -8px color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          <span className="hidden text-sm font-medium sm:inline">{tr(lang, "vbLauncher")}</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[59] bg-black/30 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-0"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={tr(lang, "vbName")}
            className="vb-panel fixed z-[60] flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base font-bold text-[var(--color-ink)]">
                    {tr(lang, "vbName")}
                  </span>
                  {statusLabel && (
                    <span className="flex items-center gap-1 text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${ready ? "bg-[var(--color-success)]" : "bg-[var(--color-accent-2)]"}`}
                      />
                      {statusLabel}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--color-muted)]">{tr(lang, "vbTagline")}</p>
              </div>
              <button
                onClick={newChat}
                aria-label={tr(lang, "vbNewChat")}
                title={tr(lang, "vbNewChat")}
                className="vb-iconbtn"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label={tr(lang, "vbClose")}
                title={tr(lang, "vbClose")}
                className="vb-iconbtn"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="relative flex-1 space-y-4 overflow-y-auto px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="vb-bubble vb-bot">
                    <Markdown text={tr(lang, "vbWelcome")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="vb-suggest group flex items-center gap-2 text-left"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="vb-bubble vb-user">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="group/msg space-y-2">
                    <div className="vb-bubble vb-bot">
                      {m.content ? (
                        <Markdown text={m.content} sources={m.sources} />
                      ) : (
                        <span className="flex items-center gap-2 text-[var(--color-muted)]">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          {tr(lang, "vbThinking")}
                        </span>
                      )}
                      {m.extractive && m.content && (
                        <p className="mt-2 text-[0.68rem] italic text-[var(--color-muted)]">
                          {tr(lang, "vbExtractiveNote")}
                        </p>
                      )}
                    </div>

                    {/* sources */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-1">
                        <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">
                          {tr(lang, "vbSources")}:
                        </span>
                        {m.sources.map((s) => (
                          <a
                            key={s.n}
                            href={s.url}
                            onClick={() => track("VisaBot Source Click", { lang, source: s.source })}
                            className="vb-chip"
                            title={`${s.source}${s.title ? " — " + s.title : ""}`}
                          >
                            [{s.n}] {s.source}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* actions */}
                    {m.content && (
                      <div className="flex gap-1 pl-1 opacity-0 transition group-hover/msg:opacity-100">
                        <button onClick={() => copy(i, m.content)} className="vb-iconbtn" aria-label={tr(lang, "vbCopy")} title={tr(lang, "vbCopy")}>
                          {copied === i ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                        </button>
                        <button onClick={() => speak(m.content)} className="vb-iconbtn" aria-label={tr(lang, "vbSpeak")} title={tr(lang, "vbSpeak")}>
                          <Volume2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>

            {/* scroll-to-bottom */}
            {!atBottom && (
              <button
                onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                aria-label={tr(lang, "vbScrollDown")}
                className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-md"
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            )}

            {/* Input */}
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-end gap-2"
              >
                {hasSR && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={listening ? tr(lang, "vbMicStop") : tr(lang, "vbMic")}
                    title={listening ? tr(lang, "vbMicStop") : tr(lang, "vbMic")}
                    className={`vb-iconbtn mb-0.5 ${listening ? "text-[var(--color-danger)]" : ""}`}
                  >
                    <Mic className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder={tr(lang, "vbPlaceholder")}
                  className="vb-input max-h-32 flex-1 resize-none bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
                  style={{ height: "auto" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 128) + "px";
                  }}
                />
                {busy ? (
                  <button type="button" onClick={stop} aria-label={tr(lang, "vbStop")} title={tr(lang, "vbStop")} className="vb-sendbtn">
                    <Square className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} aria-label={tr(lang, "vbSend")} title={tr(lang, "vbSend")} className="vb-sendbtn disabled:opacity-40">
                    <Send className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </form>
              <p className="mt-1.5 px-1 text-[0.62rem] text-[var(--color-muted)]">{tr(lang, "vbDisclaimer")}</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
