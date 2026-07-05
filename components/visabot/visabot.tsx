"use client";

// Floating VisaBot widget (launcher + panel). Chat state lives in the shared
// useVisabotChat hook and the thread rendering in <ChatThread/> (BB1); this
// file keeps only the widget's own UI: launcher, dialog shell, voice in/out.
// Intentional divergences vs the /asistente console:
//   • NO charts (invariant of the Claude proxy — the widget surface prompt
//     says it can't render charts, so it never builds them);
//   • voice input (mic) + read-aloud actions;
//   • hidden entirely on /asistente (the console is the surface there).
import * as React from "react";
import {
  Sparkles, X, Send, Square, RotateCcw, ArrowDown, Mic, BookOpen,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/lang-provider";
import { basePath } from "@/lib/site-map";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { Markdown } from "./markdown";
import { ChatThread } from "./chat-thread";
import { SemanticConsent } from "./semantic-consent";
import { useVisabotChat } from "./use-visabot-chat";

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
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [listening, setListening] = React.useState(false);
  // computed after mount only — avoids SSR/client hydration mismatch (window
  // is undefined on the server, so this must not affect the first render).
  const [hasSR, setHasSR] = React.useState(false);
  React.useEffect(() => setHasSR(!!getSR()), []);

  const {
    messages, input, setInput, busy, send, stop, newChat, copy, copiedId,
    atBottom, onScroll, scrollToBottom, scrollRef, inputRef, warm,
    semantic, modelReady, constrained, enableSemantic,
  } = useVisabotChat({ lang, surface: "widget" });

  // BB2 — WAI-ARIA dialog focus trap via the shared hook (replaces the old
  // manual Tab-cycling listener). Escape stays here (we own the open state).
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const wasOpen = React.useRef(false);
  const recRef = React.useRef<SR | null>(null);

  // ── open: warm up engine (BM25 always; semantic only with prior consent),
  //    load suggestions, focus input ──────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    warm();
    track("VisaBot Open", { lang });
    fetch("/rag/suggestions.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSuggestions(d[lang] || []))
      .catch(() => {});
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, lang, warm, inputRef]);

  // ── return focus to the launcher when the panel closes (a11y). The trap's
  //    own restore can't do this: the launcher unmounts while the panel is
  //    open, so the element the trap remembers is a detached node. ───────────
  React.useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) launcherRef.current?.focus();
  }, [open]);

  // ── Esc to close (Tab cycling is handled by useFocusTrap) ─────────────────
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

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

  // hide the floating launcher on the dedicated /asistente page (the inline
  // console is the surface there). All hooks above run unconditionally.
  if (basePath(pathname || "/") === "/asistente") return null;

  // status pill: ready → active · downloading → loading · no consent → lexical
  const statusLabel = modelReady
    ? tr(lang, "vbEngineReady")
    : semantic
      ? tr(lang, "vbLoadingEngine")
      : tr(lang, "vbSemanticOff");

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
                  <span className="flex items-center gap-1 text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${modelReady ? "bg-[var(--color-success)]" : semantic ? "bg-[var(--color-accent-2)]" : "bg-[var(--color-muted)]"}`}
                    />
                    {statusLabel}
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--color-muted)]">{tr(lang, "vbTagline")}</p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={newChat}
                  aria-label={tr(lang, "vbNewChat")}
                  title={tr(lang, "vbNewChat")}
                  className="vb-clearbtn"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
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

              <ChatThread
                lang={lang}
                variant="widget"
                messages={messages}
                copiedId={copiedId}
                onCopy={copy}
                onSpeak={speak}
              />
            </div>

            {/* scroll-to-bottom */}
            {!atBottom && (
              <button
                onClick={scrollToBottom}
                aria-label={tr(lang, "vbScrollDown")}
                className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-md"
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            )}

            {/* AZ1 — semantic engine consent (no ~150 MB download without a gesture) */}
            <SemanticConsent
              lang={lang}
              semantic={semantic}
              constrained={constrained}
              onEnable={() => enableSemantic()}
            />

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
