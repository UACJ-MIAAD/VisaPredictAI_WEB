"use client";

import * as React from "react";
import { Sparkles, Send, Square, Copy, Check, Loader2, ArrowDown, Plus, BookOpen } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { Markdown } from "./markdown";
import { retrieve, generate, warmUp, isModelReady } from "./engine";
import type { ChatMessage, Source } from "./types";

const MES = {
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};
const monthLabel = (m: string | null, lang: "es" | "en") => {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  const name = MES[lang][+mo - 1] || "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};

// minimal **bold** → <strong> so leads can emphasize without invalid <div> in <p>
const rich = (t: string) =>
  t.split(/\*\*/).map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : <React.Fragment key={i}>{s}</React.Fragment>));

type Meta = { chunks: number; sources: number; langs: string[]; latestMonth: string | null };

export function AssistantConsole() {
  const { lang } = useLang();
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [copied, setCopied] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    warmUp();
    fetch("/rag/meta.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setMeta(d)).catch(() => {});
    fetch("/rag/suggestions.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSuggestions(d[lang] || [])).catch(() => {});
    const iv = setInterval(() => { if (isModelReady()) { setReady(true); clearInterval(iv); } }, 600);
    return () => clearInterval(iv);
  }, [lang]);

  React.useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  const send = React.useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      setBusy(true);
      track("VisaBot Query", { lang, surface: "console" });
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

      let sources: Source[] = [];
      try {
        sources = await retrieve(q, lang, 6);
      } catch {
        /* index missing → answer conversationally with empty context */
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await generate(
          q, history, sources, lang,
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
          c[c.length - 1] = { role: "assistant", content: res.text, sources, extractive: res.extractive };
          return c;
        });
        if (res.extractive) track("VisaBot Fallback", { lang, surface: "console" });
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

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };
  const newChat = () => { stop(); setMessages([]); inputRef.current?.focus(); };
  const copy = (i: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600);
  };

  const stats = [
    { label: tr(lang, "acStatChunks"), value: meta ? meta.chunks.toLocaleString(lang === "en" ? "en-US" : "es-MX") : "—" },
    { label: tr(lang, "acStatSources"), value: meta ? String(meta.sources) : "—" },
    { label: tr(lang, "acStatLangs"), value: meta ? meta.langs.map((l) => l.toUpperCase()).join(" · ") : "—" },
    { label: tr(lang, "acStatLatest"), value: meta ? monthLabel(meta.latestMonth, lang) : "—" },
    { label: tr(lang, "acStatRetrieval"), value: tr(lang, "acStatRetrievalVal") },
  ];

  const steps = [1, 2, 3, 4].map((n) => ({
    t: tr(lang, `acStep${n}T`),
    b: tr(lang, `acStep${n}B`),
  }));

  return (
    <>
      <section id="asistente" className="section">
        <div className="section-inner">
          <span className="section-tag">{tr(lang, "acTag")}</span>
          <h2 className="section-title">{tr(lang, "acTitle")}</h2>
          <p className="section-sub">{rich(tr(lang, "acLead"))}</p>

          {/* knowledge-base stats (derived from the index, not hardcoded) */}
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="bg-[var(--color-surface)] px-4 py-4">
                <div className="font-serif text-xl font-bold text-[var(--color-ink)]">{s.value}</div>
                <div className="mt-1 text-[0.7rem] uppercase tracking-wide text-[var(--color-muted)]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* the console */}
          <div
            className="vb-console relative mt-8 flex flex-col overflow-hidden rounded-2xl border border-border bg-[var(--color-surface)]"
            style={{ height: "min(620px, 72vh)" }}
          >
            <header className="flex items-center gap-3 border-b border-border bg-[var(--color-bg)] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-base font-bold text-[var(--color-ink)]">{tr(lang, "vbName")}</div>
                <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${ready ? "bg-[var(--color-success)]" : "bg-[var(--color-accent-2)]"}`} />
                  {ready ? tr(lang, "vbEngineReady") : tr(lang, "vbLoadingEngine")}
                </div>
              </div>
              {messages.length > 0 && (
                <button onClick={newChat} className="vb-iconbtn" aria-label={tr(lang, "vbNewChat")} title={tr(lang, "vbNewChat")}>
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              )}
            </header>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-start justify-center gap-4">
                  <p className="text-sm text-[var(--color-muted)]">{tr(lang, "acStartHint")}</p>
                  <div className="flex flex-col gap-2 self-stretch">
                    <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">{tr(lang, "acTry")}</span>
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)} className="vb-suggest flex items-center gap-2 text-left">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) =>
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
                          <p className="mt-2 text-[0.68rem] italic text-[var(--color-muted)]">{tr(lang, "vbExtractiveNote")}</p>
                        )}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pl-1">
                          <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">{tr(lang, "vbSources")}:</span>
                          {m.sources.map((s) => (
                            <a key={s.n} href={s.url} onClick={() => track("VisaBot Source Click", { lang, source: s.source })} className="vb-chip" title={`${s.source}${s.title ? " — " + s.title : ""}`}>
                              [{s.n}] {s.source}
                            </a>
                          ))}
                        </div>
                      )}
                      {m.content && (
                        <div className="flex gap-1 pl-1 opacity-0 transition group-hover/msg:opacity-100">
                          <button onClick={() => copy(i, m.content)} className="vb-iconbtn" aria-label={tr(lang, "vbCopy")} title={tr(lang, "vbCopy")}>
                            {copied === i ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )
              )}
            </div>

            {!atBottom && (
              <button
                onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                aria-label={tr(lang, "vbScrollDown")}
                className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--color-surface)] p-2 shadow-md"
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            )}

            <div className="border-t border-border bg-[var(--color-bg)] px-3 py-3">
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  rows={1}
                  placeholder={tr(lang, "vbPlaceholder")}
                  className="vb-input max-h-32 flex-1 resize-none bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
                  onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
                />
                {busy ? (
                  <button type="button" onClick={stop} className="vb-sendbtn" aria-label={tr(lang, "vbStop")} title={tr(lang, "vbStop")}>
                    <Square className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="vb-sendbtn disabled:opacity-40" aria-label={tr(lang, "vbSend")} title={tr(lang, "vbSend")}>
                    <Send className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </form>
              <p className="mt-1.5 px-1 text-[0.62rem] text-[var(--color-muted)]">{tr(lang, "vbDisclaimer")}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="section section--alt">
        <div className="section-inner">
          <span className="section-tag">{tr(lang, "acHowTag")}</span>
          <h2 className="section-title">{tr(lang, "acHowTitle")}</h2>
          <p className="section-sub">{tr(lang, "acHowLead")}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {steps.map((s) => (
              <div key={s.t} className="border-t-2 border-[var(--color-rule)] pt-4">
                <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{s.t}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--color-muted)]">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
