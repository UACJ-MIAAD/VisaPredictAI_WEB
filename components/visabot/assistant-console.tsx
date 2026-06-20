"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Sparkles, Send, Square, Copy, Check, Loader2, ArrowDown, Plus, BookOpen,
  TrendingUp, BarChart3, ArrowUpDown, PieChart as PieIcon,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { Markdown } from "./markdown";
import { retrieve, generate, warmUp, isModelReady } from "./engine";
import type { ChatMessage, ChartPayload, Source } from "./types";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import {
  detectEntities, buildLine, buildCompare, buildMovement, buildStatus, buildPanorama, type Kpi,
} from "@/lib/visabot/analytics";

// charts are lazy — Recharts only ships when the first chart renders
const VisaChart = dynamic(() => import("./visa-chart"), {
  ssr: false,
  loading: () => <div className="mt-2 h-[250px] animate-pulse rounded-xl border border-border bg-[var(--color-surface-soft)]" />,
});

const rich = (t: string) =>
  t.split(/\*\*/).map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : <React.Fragment key={i}>{s}</React.Fragment>));

// pick a chart from a free-text query using detected entities
function chartForQuery(q: string, panel: Panel, lang: "es" | "en"): ChartPayload | null {
  const e = detectEntities(q, panel);
  const t = e.table || "FAD";
  const move = /movimiento|retroces|avanc|movement|retrogress|advanc/i.test(q);
  const status = /estado|current|disponib|status|r[eé]gimen|c\/f\/u/i.test(q);
  if (e.country && e.category) {
    if (move) return buildMovement(panel, e.country, e.category, t, lang);
    if (status) return buildStatus(panel, lang, { country: e.country, category: e.category, table: t });
    return buildLine(panel, e.country, e.category, t, lang);
  }
  if (e.category) return buildCompare(panel, e.category, t, lang);
  if (e.country && status) return buildStatus(panel, lang, { country: e.country });
  return null;
}

function Select({ label, value, onChange, options, fmt }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; fmt?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col text-[0.7rem] text-[var(--color-muted)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-lg border border-border bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-ink)]"
      >
        {options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : o}</option>)}
      </select>
    </label>
  );
}

export function AssistantConsole() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [panelErr, setPanelErr] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [copied, setCopied] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  // context selectors (drive the tool buttons)
  const [country, setCountry] = React.useState("mexico");
  const [category, setCategory] = React.useState("F3");
  const [table, setTable] = React.useState("FAD");

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    warmUp();
    loadPanel().then(setPanel).catch(() => setPanelErr(true));
    fetch("/rag/suggestions.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSuggestions(d[lang] || [])).catch(() => {});
    const iv = setInterval(() => { if (isModelReady()) { setReady(true); clearInterval(iv); } }, 600);
    return () => clearInterval(iv);
  }, [lang]);

  // align defaults with what the panel actually has
  React.useEffect(() => {
    if (!panel) return;
    if (!panel.countries.includes(country)) setCountry(panel.countries.includes("mexico") ? "mexico" : panel.countries[0]);
    if (!panel.categories.includes(category)) setCategory(panel.categories.includes("F3") ? "F3" : panel.categories[0]);
    if (!panel.tables.includes(table)) setTable(panel.tables.includes("FAD") ? "FAD" : panel.tables[0]);
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  const pushBot = (msg: ChatMessage) => setMessages((m) => [...m, msg]);

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
      try { sources = await retrieve(q, lang, 6); } catch { /* answer conversationally */ }
      const chart = panel ? chartForQuery(q, panel, lang) : null;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await generate(
          q, history, sources, lang,
          (delta) => setMessages((m) => {
            const c = [...m]; const last = c[c.length - 1];
            c[c.length - 1] = { ...last, content: last.content + delta };
            return c;
          }),
          ctrl.signal,
        );
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: res.text, sources, extractive: res.extractive, chart: chart || undefined };
          return c;
        });
        if (res.extractive) track("VisaBot Fallback", { lang, surface: "console" });
      } catch {
        setMessages((m) => {
          const c = [...m]; const last = c[c.length - 1];
          c[c.length - 1] = { ...last, content: last.content || tr(lang, "vbError"), chart: chart || undefined };
          return c;
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, lang, messages, panel],
  );

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };
  const newChat = () => { stop(); setMessages([]); inputRef.current?.focus(); };
  const copy = (i: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600);
  };

  // tool buttons build a chart from the current selectors and drop it into the chat
  const runTool = (kind: "evol" | "compare" | "move" | "status") => {
    if (!panel) return;
    track("VisaBot Tool", { lang, tool: kind });
    let chart: ChartPayload | null = null;
    let lead = "";
    if (kind === "evol") { chart = buildLine(panel, country, category, table, lang); lead = tr(lang, "acHereEvol"); }
    else if (kind === "compare") { chart = buildCompare(panel, category, table, lang); lead = tr(lang, "acHereCompare"); }
    else if (kind === "move") { chart = buildMovement(panel, country, category, table, lang); lead = tr(lang, "acHereMove"); }
    else { chart = buildStatus(panel, lang, { country, category, table }); lead = tr(lang, "acHereStatus"); }
    pushBot(chart ? { role: "assistant", content: lead, chart } : { role: "assistant", content: tr(lang, "acNoData") });
    setAtBottom(true);
  };

  const kpis: Kpi[] = panel ? buildPanorama(panel, lang) : [];
  const tools = [
    { k: "evol" as const, icon: TrendingUp, label: tr(lang, "toolEvol") },
    { k: "compare" as const, icon: BarChart3, label: tr(lang, "toolCompare") },
    { k: "move" as const, icon: ArrowUpDown, label: tr(lang, "toolMove") },
    { k: "status" as const, icon: PieIcon, label: tr(lang, "toolStatus") },
  ];

  return (
    <>
      <section id="asistente" className="section">
        <div className="section-inner">
          <span className="section-tag">{tr(lang, "acTag")}</span>
          <h2 className="section-title">{tr(lang, "acTitle")}</h2>
          <p className="section-sub">{rich(tr(lang, "acLead"))}</p>

          <div className="mt-8 gap-6 lg:grid lg:grid-cols-[300px_1fr]">
            {/* ── Sidebar / command panel ── */}
            <aside className="vb-aside mb-6 flex flex-col gap-6 lg:mb-0 lg:sticky lg:top-20 lg:self-start">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <div className="font-serif text-base font-bold text-[var(--color-ink)]">{tr(lang, "vbName")}</div>
                  <div className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-muted)]">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${ready ? "bg-[var(--color-success)]" : "bg-[var(--color-accent-2)]"}`} />
                    {ready ? tr(lang, "vbEngineReady") : tr(lang, "vbLoadingEngine")}
                  </div>
                </div>
              </div>

              {/* Panorama */}
              <div>
                <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acPanorama")}</h3>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-2">
                  {(panel ? kpis : Array.from({ length: 6 }, () => null)).map((k, i) => (
                    <div key={i} className="bg-[var(--color-surface)] px-3 py-2.5" title={k?.hint}>
                      <div className="font-serif text-base font-bold leading-tight text-[var(--color-ink)]">{k ? k.value : "—"}</div>
                      <div className="mt-0.5 text-[0.6rem] leading-tight text-[var(--color-muted)]">{k ? k.label : "…"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Context selectors */}
              <div>
                <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acContext")}</h3>
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                  <Select label={tr(lang, "acSelCountry")} value={country} onChange={setCountry} options={panel?.countries ?? [country]} fmt={countryLabel} />
                  <Select label={tr(lang, "acSelCategory")} value={category} onChange={setCategory} options={panel?.categories ?? [category]} />
                  <Select label={tr(lang, "acSelTable")} value={table} onChange={setTable} options={panel?.tables ?? [table]} />
                </div>
              </div>

              {/* Tools */}
              <div>
                <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acTools")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {tools.map((t) => (
                    <button
                      key={t.k}
                      onClick={() => runTool(t.k)}
                      disabled={!panel}
                      className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2 text-left text-xs text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      <t.icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
                      <span className="leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
                {panelErr && <p className="mt-2 text-[0.7rem] text-[var(--color-danger)]">{tr(lang, "acDataError")}</p>}
              </div>

              {/* Quick queries */}
              {suggestions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acQuick")}</h3>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)} className="vb-suggest flex items-center gap-2 text-left text-[0.8rem]">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* ── Chat column ── */}
            <div className="vb-console relative flex flex-col overflow-hidden rounded-2xl border border-border bg-[var(--color-surface)]" style={{ height: "min(680px, 78vh)" }}>
              <header className="flex items-center gap-2 border-b border-border bg-[var(--color-bg)] px-4 py-2.5">
                <span className="flex-1 font-serif text-sm font-bold text-[var(--color-ink)]">{tr(lang, "acConversation")}</span>
                {messages.length > 0 && (
                  <button onClick={newChat} className="vb-iconbtn" aria-label={tr(lang, "vbNewChat")} title={tr(lang, "vbNewChat")}>
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </header>

              <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions text">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-start justify-center gap-3">
                    <Markdown text={tr(lang, "vbWelcome")} />
                    <p className="text-sm text-[var(--color-muted)]">{tr(lang, "acStartHint")}</p>
                  </div>
                ) : (
                  messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <div className="vb-bubble vb-user">{m.content}</div>
                      </div>
                    ) : (
                      <div key={i} className="group/msg space-y-2">
                        <div className="vb-bubble vb-bot" style={{ maxWidth: "100%" }}>
                          {m.content ? (
                            <Markdown text={m.content} sources={m.sources} />
                          ) : (
                            <span className="flex items-center gap-2 text-[var(--color-muted)]">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              {tr(lang, "vbThinking")}
                            </span>
                          )}
                          {m.chart && <VisaChart spec={m.chart} />}
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
                <button onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })} aria-label={tr(lang, "vbScrollDown")} className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--color-surface)] p-2 shadow-md">
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
                    <button type="button" onClick={stop} className="vb-sendbtn" aria-label={tr(lang, "vbStop")} title={tr(lang, "vbStop")}><Square className="h-4 w-4" aria-hidden /></button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} className="vb-sendbtn disabled:opacity-40" aria-label={tr(lang, "vbSend")} title={tr(lang, "vbSend")}><Send className="h-4 w-4" aria-hidden /></button>
                  )}
                </form>
                <p className="mt-1.5 px-1 text-[0.62rem] text-[var(--color-muted)]">{tr(lang, "vbDisclaimer")}</p>
              </div>
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
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="border-t-2 border-[var(--color-rule)] pt-4">
                <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{tr(lang, `acStep${n}T`)}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--color-muted)]">{tr(lang, `acStep${n}B`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
