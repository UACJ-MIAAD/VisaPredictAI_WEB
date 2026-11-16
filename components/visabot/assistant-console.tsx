"use client";

// Full-page VisaBot console (/asistente). Chat state lives in the shared
// useVisabotChat hook and the thread rendering in <ChatThread/> (BB1); this
// file keeps the console's own UI: sidebar (KPIs, context selects, chart
// tools), modals, and the chart pipeline. Intentional divergences vs the
// floating widget:
//   • charts ARE rendered here (surface "console" — the proxy prompt allows
//     it) and every query goes through chartForQuery via the hook's prepare;
//   • analytics events carry surface: "console";
//   • retrieval failures don't abort the answer (a chart can still ground it).
import * as React from "react";
import dynamic from "next/dynamic";
import {
  Sparkles, Send, Square, ArrowDown, RotateCcw, BookOpen,
  TrendingUp, BarChart3, ArrowUpDown, PieChart as PieIcon, X, Info,
  LineChart as LineIcon, Grid3x3, Radar as RadarIcon, SlidersHorizontal,
  Lightbulb, Database, Cpu, Quote, AreaChart as ForecastIcon, Maximize2, Minimize2, ArrowUpRight,
} from "lucide-react";

type PromptCat = { icon: string; cat: string; items: string[] };
const PROMPT_ICON: Record<string, typeof BookOpen> = {
  glossary: BookOpen, data: Database, models: Cpu, charts: BarChart3, refs: Quote,
};
import { useLang } from "@/components/lang-provider";
import { localePath } from "@/lib/site-map";
import { tr } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { track } from "@/lib/analytics";
import { ChatThread } from "./chat-thread";
import { AssistantSidebar, type ToolDef, type ToolKind } from "./assistant-sidebar";
import { SemanticConsent } from "./semantic-consent";
import { useVisabotChat } from "./use-visabot-chat";
import { chartForQuery } from "@/lib/visabot/chart-router";
import type { ChartPayload, Source, SyntheticDescriptor } from "./types";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, type ForecastStore } from "@/lib/data/forecasts";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import {
  buildLine, buildCompare, buildMovement, buildStatus, buildMultiLine,
  buildHeatmap, buildRadar, buildForecast, buildPanorama, buildMonthTable,
  buildBulletinDiff, bulletinDiffText, buildFollowUps, mergeFollowUp,
  monthTableText, chartContextNote, chartUserNote, monthLabel, type Kpi, type ChartSpec,
} from "@/lib/visabot/analytics";

const blockOf = (cat: string) => (/^F/i.test(cat) ? "familia" : "empleo");

// Panel year range derived from the build-time stats (regla #0 — never hand-typed).
// The chat.mjs security allowlist matches these synthetic sources by the PREFIX
// "VisaPredict AI panel (" / "Panel VisaPredict AI (", so the year can vary freely.
const PANEL_RANGE = `${SITE_STATS.dateFirst.slice(0, 4)}–${SITE_STATS.dateLast.slice(0, 4)}`;
const panelSource = (lang: "es" | "en") =>
  lang === "en" ? `VisaPredict AI panel (${PANEL_RANGE})` : `Panel VisaPredict AI (${PANEL_RANGE})`;

// Fisher-Yates shuffle + take n — gives a fresh random pick each time the prompt
// library opens, drawn from a larger pool.
const sample = <T,>(arr: T[], n: number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

const VisaChart = dynamic(() => import("./visa-chart"), {
  ssr: false,
  loading: () => <div className="mt-2 h-[250px] animate-pulse rounded-xl border border-border bg-[var(--color-surface-soft)]" />,
});


export function AssistantConsole() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [forecasts, setForecasts] = React.useState<ForecastStore | null>(null);
  const [panelErr, setPanelErr] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [navOpen, setNavOpen] = React.useState(false); // mobile sidebar drawer
  const [stage, setStage] = React.useState(false);
  // J2 — ultra-wide (≥1920px): the sidebar splits into a controls-only left
  // rail + an insights right rail (KPIs, quick questions). Driven by
  // matchMedia instead of CSS-hidden duplicates so every control exists
  // exactly once in the DOM (keeps role/text queries unambiguous for e2e).
  const [ultra, setUltra] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1920px)");
    const update = () => setUltra(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [howOpen, setHowOpen] = React.useState(false); // "how it works" modal
  const [promptsOpen, setPromptsOpen] = React.useState(false); // prompt-library modal
  const stageTrapRef = useFocusTrap<HTMLDivElement>(stage && !navOpen && !howOpen && !promptsOpen);
  const howTrapRef = useFocusTrap<HTMLDivElement>(howOpen);
  const promptsTrapRef = useFocusTrap<HTMLDivElement>(promptsOpen);
  const navTrapRef = useFocusTrap<HTMLElement>(navOpen); // mobile tools drawer (finding 10)
  const [prompts, setPrompts] = React.useState<PromptCat[]>([]);
  const [promptsView, setPromptsView] = React.useState<PromptCat[]>([]); // shuffled subset shown in the modal
  const openPrompts = () => {
    setPromptsView(prompts.map((p) => ({ ...p, items: stage ? p.items.slice(0, 6) : sample(p.items, 6) })));
    setPromptsOpen(true);
  };

  const [country, setCountry] = React.useState("mexico");
  const [category, setCategory] = React.useState("F3");
  const [table, setTable] = React.useState("FAD");
  const [month, setMonth] = React.useState("");
  const [monthB, setMonthB] = React.useState(""); // second month for the compare-bulletins view
  const months = React.useMemo(() => panel ? [...new Set(panel.rows.map((r) => r.bulletinMonth))].sort().reverse() : [], [panel]);

  // console-only: build the chart for the query and prepend its synthetic
  // grounding source so the LLM interprets the rendered chart / month table.
  // US I1 (#30): the synthetic source is DISPLAY + extractive-fallback only
  // (marked `synthetic: true`; engine.generate strips it from the POSTed
  // context) — the server rebuilds the same text itself from the returned
  // descriptor over hash-verified release data, and echoes what it actually
  // used in the {t:"sources"} frame.
  const prepare = React.useCallback((rq: string, sources: Source[]): { sources: Source[]; chart?: ChartPayload; synthetics?: SyntheticDescriptor[] } => {
    const res = panel ? chartForQuery(rq, panel, lang, forecasts) : null;
    const chart = res?.chart;
    // Ground the LLM in the real month data so it answers any cell and never
    // looks "limited to recent years" — the table covers the full panel range.
    if (res?.grounding && chart?.kind === "priorityCheck") {
      // The exact comparison is also the entire offline fallback; unrelated
      // retrieved bulletin cells must never overwrite its country or cutoff.
      sources=[{n:1,title:chart.title,source:panelSource(lang),url:localePath("/datos-historicos",lang)+"#historico",text:res.grounding.text,display:res.grounding.display,synthetic:true}];
    } else if (res?.grounding && chart) {
      sources = [{ n: 1, title: chart.title, source: panelSource(lang), url: localePath("/datos-historicos", lang) + "#historico", text: res.grounding.text, display: res.grounding.display, synthetic: true },
        ...sources.map((s) => ({ ...s, n: s.n + 1 }))];
    } else if (chart?.kind === "table") {
      const ml = monthLabel(chart.month, lang);
      sources = [{ n: 1, title: `Visa Bulletin ${ml} · ${chart.tableType}`, source: panelSource(lang), url: localePath("/datos-historicos", lang) + "#historico", text: monthTableText(chart as Extract<ChartSpec, { kind: "table" }>, lang), display: monthTableText(chart as Extract<ChartSpec, { kind: "table" }>, lang), synthetic: true },
        ...sources.map((s) => ({ ...s, n: s.n + 1 }))];
    } else if (chart?.kind === "bulletinDiff") {
      // ground the comparison as real panel data (full per-cell transitions)
      sources = [{ n: 1, title: chart.title, source: panelSource(lang), url: localePath("/datos-historicos", lang) + "#historico", text: bulletinDiffText(chart, lang), display: chartUserNote(chart, lang) ?? undefined, synthetic: true },
        ...sources.map((s) => ({ ...s, n: s.n + 1 }))];
    } else if (chart) {
      // Tell the LLM a chart is rendered alongside its answer so it interprets
      // it instead of replying "I can't show graphs" (esp. forecasts).
      const note = chartContextNote(chart, lang);
      if (note)
        sources = [{ n: 1, title: chart.title, source: lang === "en" ? "Live chart (real data panel)" : "Gráfico en vivo (panel de datos real)", url: localePath("/asistente", lang), text: note, display: chartUserNote(chart, lang) ?? undefined, synthetic: true },
          ...sources.map((s) => ({ ...s, n: s.n + 1 }))];
    }
    // Only send the descriptor when a synthetic source was actually attached
    // (a table chart always grounds; other kinds only when their note exists).
    const grounded = sources.some((s) => s.synthetic);
    return { sources, chart: chart || undefined, synthetics: res?.descriptor && grounded ? [res.descriptor] : undefined };
  }, [panel, lang, forecasts]);

  const {
    messages, setMessages, input, setInput, busy, send, stop, newChat, copy, copiedId,
    atBottom, setAtBottom, onScroll, scrollToBottom, scrollRef, inputRef, warm,
    semantic, modelReady, dlProgress, constrained, enableSemantic, liveStatus,
  } = useVisabotChat({ lang, surface: "console", prepare, mergeFollowUp });

  // sending from anywhere in the console also closes the mobile drawer
  const sendQ = React.useCallback((t: string) => {
    setNavOpen(false);
    void send(t);
    inputRef.current?.focus({preventScroll: true});
  }, [send, inputRef]);

  React.useEffect(() => {
    warm();
    loadPanel().then(setPanel).catch(() => setPanelErr(true));
    loadForecasts().then(setForecasts).catch(() => {}); // real model forecasts (fallback handled inside buildForecast)
    fetch("/rag/suggestions.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSuggestions((d[lang]?.length ? d[lang] : d.es || d.en) || [])).catch(() => {});
    fetch("/rag/prompts.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPrompts((d[lang]?.length ? d[lang] : d.es || d.en) || [])).catch(() => {});
  }, [lang, warm]);

  React.useEffect(() => {
    if (!panel) return;
    if (!panel.countries.includes(country)) setCountry(panel.countries.includes("mexico") ? "mexico" : panel.countries[0]);
    if (!panel.categories.includes(category)) setCategory(panel.categories.includes("F3") ? "F3" : panel.categories[0]);
    if (!panel.tables.includes(table)) setTable(panel.tables.includes("FAD") ? "FAD" : panel.tables[0]);
    if (!month && months.length) setMonth(months[0]);
    // default comparison month ≈ one year before the latest bulletin
    if (!monthB && months.length) setMonthB(months[Math.min(12, months.length - 1)]);
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") {
      if (!navOpen && !howOpen && !promptsOpen) setStage(false);
      setNavOpen(false); setHowOpen(false); setPromptsOpen(false);
    } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, howOpen, promptsOpen]);

  React.useEffect(() => {
    if (!stage) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [stage]);

  const runTool = (kind: ToolKind) => {
    if (!panel) return;
    track("VisaBot Tool", { lang, tool: kind });
    setNavOpen(false);
    let chart: ChartPayload | null = null, lead = "";
    if (kind === "table") { chart = buildMonthTable(panel, month || months[0], table, lang); lead = tr(lang, "acHereTable"); }
    else if (kind === "diff") { chart = buildBulletinDiff(panel, month || months[0], monthB || months[Math.min(12, months.length - 1)], table, lang); lead = tr(lang, "acHereDiff"); }
    else if (kind === "forecast") { chart = buildForecast(panel, country, category, table, lang, forecasts?.horizonMonths || undefined, 48, forecasts); lead = tr(lang, "acHereForecast"); }
    else if (kind === "evol") { chart = buildLine(panel, country, category, table, lang); lead = tr(lang, "acHereEvol"); }
    else if (kind === "compare") { chart = buildCompare(panel, category, table, lang); lead = tr(lang, "acHereCompare"); }
    else if (kind === "move") { chart = buildMovement(panel, country, category, table, lang); lead = tr(lang, "acHereMove"); }
    else if (kind === "race") { chart = buildMultiLine(panel, category, table, lang, forecasts); lead = tr(lang, "acHereRace"); }
    else if (kind === "heat") { chart = buildHeatmap(panel, blockOf(category), table, lang); lead = tr(lang, "acHereHeat"); }
    else if (kind === "radar") { chart = buildRadar(panel, table, lang); lead = tr(lang, "acHereRadar"); }
    else { chart = buildStatus(panel, lang, { country, category, table }); lead = tr(lang, "acHereStatus"); }
    setMessages((m) => [...m, chart ? { role: "assistant", content: lead, chart } : { role: "assistant", content: tr(lang, "acNoData") }]);
    setAtBottom(true);
  };

  const kpis: Kpi[] = panel ? buildPanorama(panel, lang) : [];
  // contextual follow-up chips from the last user turn, shown under a finished answer
  const lastMsg = messages[messages.length - 1];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const followUps = !busy && panel && lastMsg?.role === "assistant" && lastMsg.content
    ? buildFollowUps(lastUserMsg, lang, panel) : [];
  const tools: ToolDef[] = [
    { k: "forecast", icon: ForecastIcon, label: tr(lang, "toolForecast") },
    { k: "evol", icon: TrendingUp, label: tr(lang, "toolEvol") },
    { k: "compare", icon: BarChart3, label: tr(lang, "toolCompare") },
    { k: "move", icon: ArrowUpDown, label: tr(lang, "toolMove") },
    { k: "status", icon: PieIcon, label: tr(lang, "toolStatus") },
    { k: "race", icon: LineIcon, label: tr(lang, "toolRace") },
    { k: "heat", icon: Grid3x3, label: tr(lang, "toolHeat") },
    { k: "radar", icon: RadarIcon, label: tr(lang, "toolRadar") },
  ];

  // shared props for the three sidebar placements (drawer / left rail / ultra
  // right rail) — the blocks themselves live in <AssistantSidebar/>
  const sidebarProps = {
    lang, panel, panelErr, kpis, months, suggestions, tools, runTool,
    onAsk: sendQ,
    country, setCountry, category, setCategory, table, setTable,
    month, setMonth, monthB, setMonthB,
  };

  const latestMonth = panel?.monthRange[1] || SITE_STATS.dateLast.slice(0, 7);
  const starters = [
    { id: "forecast", icon: ForecastIcon, title: tr(lang, "acStarterForecast"), hint: `${countryLabel(country, lang)} · ${category} · ${table}`,
      query: lang === "en" ? `Show the ${countryLabel(country, lang)} ${category} ${table} forecast` : `Muéstrame el pronóstico de ${countryLabel(country, lang)} ${category} ${table}` },
    { id: "changes", icon: ArrowUpDown, title: tr(lang, "acStarterChanges"), hint: `${monthLabel(latestMonth, lang)} · ${table}`,
      query: lang === "en" ? `What changed in the ${monthLabel(latestMonth, lang)} bulletin, ${table}?` : `¿Qué cambió en el boletín de ${monthLabel(latestMonth, lang)}, ${table}?` },
    { id: "evidence", icon: Cpu, title: tr(lang, "acStarterEvidence"), hint: tr(lang, "acStarterEvidenceHint"),
      query: lang === "en" ? "Which models does the project compare and which one wins?" : "¿Qué modelos compara el proyecto y cuál gana?" },
  ];

  return (
    <div id="asistente" ref={stageTrapRef} role={stage ? "dialog" : undefined} aria-modal={stage || undefined} aria-label={stage ? tr(lang, "acPresentationLabel") : undefined}
      className={`vb-console ${stage ? "vb-stage" : ""} flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden border-t border-border bg-[var(--color-bg)]`}>
      {/* J2 — centered workspace frame: full-bleed up to 1720px, then centered
          with hairline side borders so ultra-wide monitors (1920–3440px) get a
          bounded app frame instead of a panel glued left + dead right half. */}
      <div data-vb-frame className="mx-auto flex h-full w-full max-w-[1720px] flex-col overflow-hidden min-[1720px]:border-x min-[1720px]:border-border">
      {/* console topbar */}
      <header className="vb-console-topbar flex items-center gap-2 border-b border-border bg-[var(--color-surface)] px-3 py-2.5 sm:px-4">
        {/* QW5 (WCAG 2.5.3): accessible name contains the visible text "Panel" */}
        <button className={`flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] ${stage ? "" : "lg:hidden"}`} onClick={() => setNavOpen(true)} aria-label={tr(lang, "acPanelToggleLabel")}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> {tr(lang, "acPanelToggle")}
        </button>
        <span className="vb-console-mark flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-btn)] text-white"><Sparkles className="h-4.5 w-4.5" aria-hidden /></span>
        <div className="min-w-0">
          {/* QW6: the console title is the page's single <h1> (/asistente had none);
              Tailwind preflight resets h1 margins/size so the look is unchanged. */}
          <h1 className="font-serif text-sm font-bold leading-tight text-[var(--color-ink)]">{tr(lang, "vbName")}</h1>
          <div className="flex items-center gap-1.5 text-[0.58rem] uppercase tracking-wide text-[var(--color-muted)]">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${modelReady ? "bg-[var(--color-success)]" : semantic ? "bg-[var(--color-accent-2)]" : "bg-[var(--color-muted)]"}`} />
            {modelReady ? tr(lang, "vbEngineReady") : semantic ? `${tr(lang, "vbLoadingEngine")}${dlProgress ? ` ${dlProgress} %` : ""}` : tr(lang, "vbSemanticOff")}
          </div>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setStage(v => !v)} aria-pressed={stage} aria-label={tr(lang, stage ? "acExitPresentation" : "acPresentation")}
          title={tr(lang, stage ? "acExitPresentation" : "acPresentation")} className="vb-stage-toggle vb-sq">
          {stage ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          <span className="hidden xl:inline">{tr(lang, stage ? "acExitPresentation" : "acPresentation")}</span>
        </button>
        <button onClick={openPrompts} className="vb-sq flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-[var(--color-muted)] transition hover:text-[var(--color-ink)] sm:px-2.5" aria-label={tr(lang, "acExamples")}>
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

      {/* two-pane app body (three panes on ultra-wide) */}
      <div className="flex min-h-0 flex-1">
        {/* desktop sidebar — on ultra-wide the insights blocks move to the
            right rail below, so this rail keeps only context + tools */}
        <aside className="vb-controls-rail hidden w-[300px] shrink-0 border-r border-border bg-[var(--color-surface)] lg:block 2xl:w-[320px]">
          <AssistantSidebar sections={ultra ? "controls" : "all"} {...sidebarProps} />
        </aside>

        {/* mobile/tablet drawer */}
        {navOpen && (
          <>
            <div className={`fixed inset-0 z-40 bg-black/40 ${stage ? "" : "lg:hidden"}`} onClick={() => setNavOpen(false)} aria-hidden />
            <aside ref={navTrapRef} role="dialog" aria-modal="true" aria-label={tr(lang, "acTools")} className={`fixed inset-y-0 left-0 z-50 w-[84%] max-w-[320px] border-r border-border bg-[var(--color-surface)] shadow-2xl ${stage ? "" : "lg:hidden"}`}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-serif text-sm font-bold">{tr(lang, "vbName")}</span>
                <button className="vb-iconbtn" onClick={() => setNavOpen(false)} aria-label={tr(lang, "acCloseTools")}><X className="h-4 w-4" aria-hidden /></button>
              </div>
              <div className="h-[calc(100%-3.25rem)]">
                <AssistantSidebar sections="all" {...sidebarProps} />
              </div>
            </aside>
          </>
        )}

        {/* chat column — min-w-0 lets it shrink below the table's min-width so the
            table scrolls inside its own box instead of widening the whole column */}
        <div className="vb-conversation-pane relative flex min-h-0 min-w-0 flex-1 flex-col">
          <p className="sr-only" role="status" aria-live="polite">{liveStatus}</p>
          {/* overscroll-contain: reaching the thread's edge never chains the
              scroll to the page (the composer stays put on mobile) */}
          <div ref={scrollRef} onScroll={onScroll} className="vb-thread flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-5 sm:px-6" role="log" aria-live="off">
            <div className="vb-thread-inner mx-auto min-w-0 max-w-[820px] space-y-5 2xl:max-w-[900px]">
              {messages.length === 0 ? (
                <div className="vb-home">
                  <div className="vb-home-eyebrow"><BookOpen className="h-3.5 w-3.5" aria-hidden /> Visa Bulletin <span aria-hidden>·</span> {monthLabel(latestMonth, lang)}</div>
                  <h2 className="vb-home-title">{tr(lang, "acHeroTitle")}<em>{tr(lang, "acHeroAccent")}</em></h2>
                  <p className="vb-home-lead">{tr(lang, "acHeroLead")}</p>
                  <div className="vb-start-grid">
                    {starters.map((s, i) => (
                      <button key={s.id} data-vb-starter={s.id} onClick={() => sendQ(s.query)} className="vb-start-card">
                        <span className="vb-start-card-top"><s.icon className="h-5 w-5" aria-hidden /><span aria-hidden>0{i + 1}</span></span>
                        <strong>{s.title}</strong><span className="vb-start-hint">{s.hint}</span>
                        <ArrowUpRight className="vb-start-arrow h-4 w-4" aria-hidden />
                      </button>
                    ))}
                  </div>
                  {prompts.length > 0 && (
                    <button onClick={openPrompts} className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline">
                      <Lightbulb className="h-4 w-4" aria-hidden /> {tr(lang, "acExamplesTitle")}
                    </button>
                  )}
                </div>
              ) : (
                <ChatThread
                  lang={lang}
                  variant="console"
                  messages={messages}
                  copiedId={copiedId}
                  onCopy={copy}
                  renderChart={(chart) => <VisaChart spec={chart} />}
                  followUps={followUps}
                  onFollowUp={sendQ}
                />
              )}
            </div>
          </div>

          {!atBottom && (
            <button onClick={scrollToBottom} aria-label={tr(lang, "vbScrollDown")} className="vb-sq absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--color-surface)] p-2 shadow-md">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          )}

          {/* AZ1 — semantic engine consent (no ~150 MB download without a gesture) */}
          <SemanticConsent
            lang={lang}
            compact
            semantic={semantic}
            constrained={constrained}
            onEnable={() => enableSemantic()}
          />

          {/* safe-area padding so the composer clears the iOS home indicator */}
          <div className="vb-composer border-t border-border bg-[var(--color-surface)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <form onSubmit={(e) => { e.preventDefault(); sendQ(input); }} className="mx-auto flex max-w-[820px] items-end gap-2 2xl:max-w-[900px]">
              <textarea
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQ(input); } }}
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
            <p className="vb-composer-hint">{tr(lang, "acComposerHint")}</p>
          </div>
        </div>

        {/* ultra-wide right rail (≥1920px): KPIs + quick questions — existing
            sidebar content relocated, so the former dead band beside the
            thread carries the panorama instead of empty background */}
        {ultra && (
          <aside className="vb-insights-rail hidden w-[320px] shrink-0 border-l border-border bg-[var(--color-surface)] min-[1920px]:block">
            <AssistantSidebar sections="insights" {...sidebarProps} />
          </aside>
        )}
      </div>
      </div>

      {/* how-it-works modal */}
      {howOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={tr(lang, "acHowTitle")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setHowOpen(false)} aria-hidden />
          <div ref={howTrapRef} className="relative max-h-[85dvh] w-full max-w-[680px] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">{tr(lang, "acHowTag")}</span>
                <h2 className="font-serif text-2xl font-bold text-[var(--color-ink)]">{tr(lang, "acHowTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{tr(lang, "acHowLead")}</p>
              </div>
              <button className="vb-iconbtn shrink-0" onClick={() => setHowOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="grid !mt-0 !gap-5 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => (
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
          <div ref={promptsTrapRef} className="relative max-h-[85dvh] w-full max-w-[760px] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]"><Lightbulb className="h-3.5 w-3.5" aria-hidden /> {tr(lang, "acExamples")}</span>
                <h2 className="font-serif text-2xl font-bold text-[var(--color-ink)]">{tr(lang, "acExamplesTitle")}</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-[var(--color-muted)]">{tr(lang, "acExamplesLead")}</p>
              </div>
              <button className="vb-iconbtn shrink-0" onClick={() => setPromptsOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="space-y-5">
              {promptsView.map((p) => {
                const Icon = PROMPT_ICON[p.icon] || BookOpen;
                return (
                  <div key={p.cat}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]"><Icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden /> {p.cat}</h3>
                    <div className="flex flex-wrap gap-2">
                      {p.items.map((q) => (
                        <button key={q} onClick={() => { setPromptsOpen(false); sendQ(q); }} className="vb-suggest text-[0.82rem]">{q}</button>
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
