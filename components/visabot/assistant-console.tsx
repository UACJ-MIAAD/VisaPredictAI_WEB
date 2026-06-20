"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Sparkles, Send, Square, Copy, Check, Loader2, ArrowDown, RotateCcw, BookOpen,
  TrendingUp, BarChart3, ArrowUpDown, PieChart as PieIcon, X, Info,
  LineChart as LineIcon, Grid3x3, Radar as RadarIcon, SlidersHorizontal,
  Lightbulb, Database, Cpu, Quote,
} from "lucide-react";

type PromptCat = { icon: string; cat: string; items: string[] };
const PROMPT_ICON: Record<string, typeof BookOpen> = {
  glossary: BookOpen, data: Database, models: Cpu, charts: BarChart3, refs: Quote,
};
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { Markdown } from "./markdown";
import { retrieve, generate, warmUp, isModelReady } from "./engine";
import type { ChatMessage, ChartPayload, Source } from "./types";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import {
  detectEntities, buildLine, buildCompare, buildMovement, buildStatus, buildMultiLine,
  buildHeatmap, buildRadar, buildPanorama, type Kpi,
} from "@/lib/visabot/analytics";

const blockOf = (cat: string) => (/^F/i.test(cat) ? "familia" : "empleo");

const VisaChart = dynamic(() => import("./visa-chart"), {
  ssr: false,
  loading: () => <div className="mt-2 h-[250px] animate-pulse rounded-xl border border-border bg-[var(--color-surface-soft)]" />,
});

function chartForQuery(q: string, panel: Panel, lang: "es" | "en"): ChartPayload | null {
  const e = detectEntities(q, panel);
  const t = e.table || "FAD";
  const move = /movimiento|retroces|avanc|movement|retrogress|advanc/i.test(q);
  const status = /estado|current|disponib|status|r[eé]gimen|c\/f\/u/i.test(q);
  if (/mapa de calor|matriz|heatmap|matrix/i.test(q)) return buildHeatmap(panel, e.block || (e.category ? blockOf(e.category) : "familia"), t, lang);
  if (/radar|huella|fingerprint/i.test(q)) return buildRadar(panel, t, lang);
  if (/carrera|todos los pa[ií]s|all countr|cada pa[ií]s|\brace\b/i.test(q) && e.category) return buildMultiLine(panel, e.category, t, lang);
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-lg border border-border bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-ink)]">
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
  const [navOpen, setNavOpen] = React.useState(false); // mobile sidebar drawer
  const [howOpen, setHowOpen] = React.useState(false); // "how it works" modal
  const [promptsOpen, setPromptsOpen] = React.useState(false); // prompt-library modal
  const [prompts, setPrompts] = React.useState<PromptCat[]>([]);

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
    fetch("/rag/prompts.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPrompts(d[lang] || [])).catch(() => {});
    const iv = setInterval(() => { if (isModelReady()) { setReady(true); clearInterval(iv); } }, 600);
    return () => clearInterval(iv);
  }, [lang]);

  React.useEffect(() => {
    if (!panel) return;
    if (!panel.countries.includes(country)) setCountry(panel.countries.includes("mexico") ? "mexico" : panel.countries[0]);
    if (!panel.categories.includes(category)) setCategory(panel.categories.includes("F3") ? "F3" : panel.categories[0]);
    if (!panel.tables.includes(table)) setTable(panel.tables.includes("FAD") ? "FAD" : panel.tables[0]);
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, atBottom]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setNavOpen(false); setHowOpen(false); setPromptsOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onScroll = () => { const el = scrollRef.current; if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60); };

  const send = React.useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput(""); setBusy(true); setNavOpen(false);
    track("VisaBot Query", { lang, surface: "console" });
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    // Época 3.1: history-aware retrieval — augment clear follow-ups ("¿y India?")
    // with the previous user turn; fresh questions (>3 words, no marker) untouched.
    const isFollowUp = /^(¿?\s*y\b|¿?\s*and\b|pero|adem[aá]s|tambi[eé]n|also|but)\b/i.test(q) || q.split(/\s+/).length <= 3;
    const prevUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const rq = isFollowUp && prevUser ? `${prevUser} ${q}` : q;
    let sources: Source[] = [];
    try { sources = await retrieve(rq, lang, 6); } catch { /* conversational */ }
    const chart = panel ? chartForQuery(q, panel, lang) : null;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await generate(q, history, sources, lang,
        (delta) => setMessages((m) => { const c = [...m]; const l = c[c.length - 1]; c[c.length - 1] = { ...l, content: l.content + delta }; return c; }),
        ctrl.signal);
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: res.text, sources, extractive: res.extractive, chart: chart || undefined }; return c; });
      if (res.extractive) track("VisaBot Fallback", { lang, surface: "console" });
    } catch {
      setMessages((m) => { const c = [...m]; const l = c[c.length - 1]; c[c.length - 1] = { ...l, content: l.content || tr(lang, "vbError"), chart: chart || undefined }; return c; });
    } finally { setBusy(false); abortRef.current = null; }
  }, [busy, lang, messages, panel]);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };
  const newChat = () => { stop(); setMessages([]); inputRef.current?.focus(); };
  const copy = (i: number, text: string) => { navigator.clipboard?.writeText(text); setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600); };

  const runTool = (kind: "evol" | "compare" | "move" | "status" | "race" | "heat" | "radar") => {
    if (!panel) return;
    track("VisaBot Tool", { lang, tool: kind });
    setNavOpen(false);
    let chart: ChartPayload | null = null, lead = "";
    if (kind === "evol") { chart = buildLine(panel, country, category, table, lang); lead = tr(lang, "acHereEvol"); }
    else if (kind === "compare") { chart = buildCompare(panel, category, table, lang); lead = tr(lang, "acHereCompare"); }
    else if (kind === "move") { chart = buildMovement(panel, country, category, table, lang); lead = tr(lang, "acHereMove"); }
    else if (kind === "race") { chart = buildMultiLine(panel, category, table, lang); lead = tr(lang, "acHereRace"); }
    else if (kind === "heat") { chart = buildHeatmap(panel, blockOf(category), table, lang); lead = tr(lang, "acHereHeat"); }
    else if (kind === "radar") { chart = buildRadar(panel, table, lang); lead = tr(lang, "acHereRadar"); }
    else { chart = buildStatus(panel, lang, { country, category, table }); lead = tr(lang, "acHereStatus"); }
    setMessages((m) => [...m, chart ? { role: "assistant", content: lead, chart } : { role: "assistant", content: tr(lang, "acNoData") }]);
    setAtBottom(true);
  };

  const kpis: Kpi[] = panel ? buildPanorama(panel, lang) : [];
  const tools = [
    { k: "evol" as const, icon: TrendingUp, label: tr(lang, "toolEvol") },
    { k: "compare" as const, icon: BarChart3, label: tr(lang, "toolCompare") },
    { k: "move" as const, icon: ArrowUpDown, label: tr(lang, "toolMove") },
    { k: "status" as const, icon: PieIcon, label: tr(lang, "toolStatus") },
    { k: "race" as const, icon: LineIcon, label: tr(lang, "toolRace") },
    { k: "heat" as const, icon: Grid3x3, label: tr(lang, "toolHeat") },
    { k: "radar" as const, icon: RadarIcon, label: tr(lang, "toolRadar") },
  ];

  const Sidebar = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div>
        <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acPanorama")}</h3>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {(panel ? kpis : Array.from({ length: 6 }, () => null)).map((k, i) => (
            <div key={i} className="bg-[var(--color-surface)] px-3 py-2.5" title={k?.hint}>
              <div className="font-serif text-base font-bold leading-tight text-[var(--color-ink)]">{k ? k.value : "—"}</div>
              <div className="mt-0.5 text-[0.6rem] leading-tight text-[var(--color-muted)]">{k ? k.label : "…"}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acContext")}</h3>
        <div className="grid grid-cols-1 gap-2">
          <Select label={tr(lang, "acSelCountry")} value={country} onChange={setCountry} options={panel?.countries ?? [country]} fmt={countryLabel} />
          <Select label={tr(lang, "acSelCategory")} value={category} onChange={setCategory} options={panel?.categories ?? [category]} />
          <Select label={tr(lang, "acSelTable")} value={table} onChange={setTable} options={panel?.tables ?? [table]} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acTools")}</h3>
        <div className="grid grid-cols-1 gap-2">
          {tools.map((t) => (
            <button key={t.k} onClick={() => runTool(t.k)} disabled={!panel} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2 text-left text-xs text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:opacity-50">
              <t.icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
              <span className="leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {panelErr && <p className="mt-2 text-[0.7rem] text-[var(--color-danger)]">{tr(lang, "acDataError")}</p>}
      </div>
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
      <p className="mt-auto text-[0.6rem] leading-snug text-[var(--color-muted)]">{tr(lang, "vbDisclaimer")}</p>
    </div>
  );

  return (
    <div id="asistente" className="flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden border-t border-border bg-[var(--color-bg)]">
      {/* console topbar */}
      <header className="flex items-center gap-2 border-b border-border bg-[var(--color-surface)] px-3 py-2.5 sm:px-4">
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] lg:hidden" onClick={() => setNavOpen(true)} aria-label={tr(lang, "acTools")}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> {tr(lang, "acPanelToggle")}
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-white"><Sparkles className="h-4.5 w-4.5" aria-hidden /></span>
        <div className="min-w-0">
          <div className="font-serif text-sm font-bold leading-tight text-[var(--color-ink)]">{tr(lang, "vbName")}</div>
          <div className="flex items-center gap-1.5 text-[0.58rem] uppercase tracking-wide text-[var(--color-muted)]">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${ready ? "bg-[var(--color-success)]" : "bg-[var(--color-accent-2)]"}`} />
            {ready ? tr(lang, "vbEngineReady") : tr(lang, "vbLoadingEngine")}
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={() => setPromptsOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-[var(--color-muted)] transition hover:text-[var(--color-ink)] sm:px-2.5" aria-label={tr(lang, "acExamples")}>
          <Lightbulb className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">{tr(lang, "acExamples")}</span>
        </button>
        <button onClick={() => setHowOpen(true)} className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-[var(--color-muted)] transition hover:text-[var(--color-ink)] sm:flex">
          <Info className="h-3.5 w-3.5" aria-hidden /> {tr(lang, "acHowTitle")}
        </button>
        {messages.length > 0 && (
          <button onClick={newChat} className="vb-clearbtn" aria-label={tr(lang, "vbNewChat")} title={tr(lang, "vbNewChat")}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">{tr(lang, "vbNewChat")}</span>
          </button>
        )}
      </header>

      {/* two-pane app body */}
      <div className="flex min-h-0 flex-1">
        {/* desktop sidebar */}
        <aside className="hidden w-[300px] shrink-0 border-r border-border bg-[var(--color-surface)] lg:block">{Sidebar}</aside>

        {/* mobile drawer */}
        {navOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />
            <aside className="fixed inset-y-0 left-0 z-50 w-[84%] max-w-[320px] border-r border-border bg-[var(--color-surface)] shadow-2xl lg:hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-serif text-sm font-bold">{tr(lang, "vbName")}</span>
                <button className="vb-iconbtn" onClick={() => setNavOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-4 w-4" aria-hidden /></button>
              </div>
              <div className="h-[calc(100%-3.25rem)]">{Sidebar}</div>
            </aside>
          </>
        )}

        {/* chat column */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-relevant="additions text">
            <div className="mx-auto max-w-[820px] space-y-4">
              {messages.length === 0 ? (
                <div className="flex min-h-[40vh] flex-col items-start justify-center gap-3">
                  <Markdown text={tr(lang, "vbWelcome")} />
                  <p className="text-sm text-[var(--color-muted)]">{tr(lang, "acStartHint")}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {suggestions.slice(0, 4).map((s) => (
                      <button key={s} onClick={() => send(s)} className="vb-suggest text-[0.8rem]">{s}</button>
                    ))}
                  </div>
                  {prompts.length > 0 && (
                    <button onClick={() => setPromptsOpen(true)} className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline">
                      <Lightbulb className="h-4 w-4" aria-hidden /> {tr(lang, "acExamplesTitle")}
                    </button>
                  )}
                </div>
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end"><div className="vb-bubble vb-user">{m.content}</div></div>
                  ) : (
                    <div key={i} className="group/msg space-y-2">
                      <div className="vb-bubble vb-bot" style={{ maxWidth: "100%" }}>
                        {m.content ? <Markdown text={m.content} sources={m.sources} /> : (
                          <span className="flex items-center gap-2 text-[var(--color-muted)]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{tr(lang, "vbThinking")}</span>
                        )}
                        {m.chart && <VisaChart spec={m.chart} />}
                        {m.extractive && m.content && <p className="mt-2 text-[0.68rem] italic text-[var(--color-muted)]">{tr(lang, "vbExtractiveNote")}</p>}
                      </div>
                      {m.sources && m.sources.some((s) => m.content.includes(`[${s.n}]`)) && (
                        <div className="flex flex-wrap items-center gap-1.5 pl-1">
                          <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">{tr(lang, "vbSources")}:</span>
                          {m.sources.filter((s) => m.content.includes(`[${s.n}]`)).map((s) => (
                            <a key={s.n} href={s.url} onClick={() => track("VisaBot Source Click", { lang, source: s.source })} className="vb-chip" title={`${s.source}${s.title ? " — " + s.title : ""}`}>[{s.n}] {s.source}</a>
                          ))}
                        </div>
                      )}
                      {m.content && (
                        <div className="flex gap-1 pl-1 opacity-0 transition group-hover/msg:opacity-100">
                          <button onClick={() => copy(i, m.content)} className="vb-iconbtn" aria-label={tr(lang, "vbCopy")} title={tr(lang, "vbCopy")}>{copied === i ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}</button>
                        </div>
                      )}
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          {!atBottom && (
            <button onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })} aria-label={tr(lang, "vbScrollDown")} className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--color-surface)] p-2 shadow-md">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          )}

          <div className="border-t border-border bg-[var(--color-surface)] px-4 py-3 sm:px-6">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-[820px] items-end gap-2">
              <textarea
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1} placeholder={tr(lang, "vbPlaceholder")}
                className="vb-input max-h-40 flex-1 resize-none rounded-xl border border-border bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
              />
              {busy ? (
                <button type="button" onClick={stop} className="vb-sendbtn" aria-label={tr(lang, "vbStop")} title={tr(lang, "vbStop")}><Square className="h-4 w-4" aria-hidden /></button>
              ) : (
                <button type="submit" disabled={!input.trim()} className="vb-sendbtn disabled:opacity-40" aria-label={tr(lang, "vbSend")} title={tr(lang, "vbSend")}><Send className="h-4 w-4" aria-hidden /></button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* how-it-works modal */}
      {howOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={tr(lang, "acHowTitle")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setHowOpen(false)} aria-hidden />
          <div className="relative max-h-[85vh] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-border bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">{tr(lang, "acHowTag")}</span>
                <h2 className="font-serif text-2xl font-bold text-[var(--color-ink)]">{tr(lang, "acHowTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{tr(lang, "acHowLead")}</p>
              </div>
              <button className="vb-iconbtn shrink-0" onClick={() => setHowOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="border-t-2 border-[var(--color-rule)] pt-3">
                  <h3 className="font-serif text-base font-bold text-[var(--color-ink)]">{tr(lang, `acStep${n}T`)}</h3>
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-[var(--color-muted)]">{tr(lang, `acStep${n}B`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* prompt-library modal (help / curated prompts) */}
      {promptsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={tr(lang, "acExamplesTitle")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setPromptsOpen(false)} aria-hidden />
          <div className="relative max-h-[85vh] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-border bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]"><Lightbulb className="h-3.5 w-3.5" aria-hidden /> {tr(lang, "acExamples")}</span>
                <h2 className="font-serif text-2xl font-bold text-[var(--color-ink)]">{tr(lang, "acExamplesTitle")}</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-[var(--color-muted)]">{tr(lang, "acExamplesLead")}</p>
              </div>
              <button className="vb-iconbtn shrink-0" onClick={() => setPromptsOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="space-y-5">
              {prompts.map((p) => {
                const Icon = PROMPT_ICON[p.icon] || BookOpen;
                return (
                  <div key={p.cat}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]"><Icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden /> {p.cat}</h3>
                    <div className="flex flex-wrap gap-2">
                      {p.items.map((q) => (
                        <button key={q} onClick={() => { setPromptsOpen(false); send(q); }} className="vb-suggest text-[0.82rem]">{q}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
