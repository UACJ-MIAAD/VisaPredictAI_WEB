"use client";

// Full-page VisaBot (/asistente). Minimal redesign (19-nov-2026): the
// conversation and a question box, with the panel (KPIs, context, one-click
// chart tools, quick questions) as a rail on desktop and a drawer on phones. The agent (netlify/functions/chat.mjs)
// reads the verified release data and decides when to draw a chart
// (show_chart); the console renders it inline. Chat state lives in
// useVisabotChat and the thread in <ChatThread/>. A `?q=` parameter (from the
// home page) is sent once the panel has loaded.
import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowUp, Square, ArrowDown, RotateCcw, BookOpen, BarChart3, X,
  Lightbulb, Database, Cpu, Quote, Maximize2, Minimize2, SlidersHorizontal,
  TrendingUp, ArrowUpDown, PieChart as PieIcon, LineChart as LineIcon, Grid3x3,
  Radar as RadarIcon, AreaChart as ForecastIcon,
} from "lucide-react";

type PromptCat = { icon: string; cat: string; items: string[] };
const PROMPT_ICON: Record<string, typeof BookOpen> = {
  glossary: BookOpen, data: Database, models: Cpu, charts: BarChart3, refs: Quote,
};
import { useLang } from "@/components/lang-provider";
import { localePath } from "@/lib/site-map";
import { tr } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { track } from "@/lib/analytics";
import { ChatThread } from "./chat-thread";
import { SemanticConsent } from "./semantic-consent";
import { AssistantSidebar, type ToolDef, type ToolKind } from "./assistant-sidebar";
import { useVisabotChat } from "./use-visabot-chat";
import { chartForQuery, chartFromAgent } from "@/lib/visabot/chart-router";
import type { AgentChart, ChartPayload, Source, SyntheticDescriptor } from "./types";
import { loadPanel, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, type ForecastStore } from "@/lib/data/forecasts";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import {
  bulletinDiffText, buildFollowUps, mergeFollowUp,
  monthTableText, chartContextNote, chartUserNote, monthLabel, type ChartSpec,
  buildLine, buildCompare, buildMovement, buildStatus, buildMultiLine,
  buildHeatmap, buildRadar, buildForecast, buildPanorama, buildMonthTable,
  buildBulletinDiff, type Kpi,
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
  const [forecastsSettled, setForecastsSettled] = React.useState(false);
  const [stage, setStage] = React.useState(false);
  const [promptsOpen, setPromptsOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false); // mobile panel drawer
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const stageTrapRef = useFocusTrap<HTMLDivElement>(stage && !promptsOpen && !navOpen, true);
  const navTrapRef = useFocusTrap<HTMLElement>(navOpen);
  // panel context (the selects the one-click tools read)
  const [country, setCountry] = React.useState("mexico");
  const [category, setCategory] = React.useState("F3");
  const [table, setTable] = React.useState("FAD");
  const [month, setMonth] = React.useState("");
  const [monthB, setMonthB] = React.useState("");
  const promptsTrapRef = useFocusTrap<HTMLDivElement>(promptsOpen);
  const [prompts, setPrompts] = React.useState<PromptCat[]>([]);
  const [promptsView, setPromptsView] = React.useState<PromptCat[]>([]);
  const openPrompts = () => {
    setPromptsView(prompts.map((p) => ({ ...p, items: stage ? p.items.slice(0, 6) : sample(p.items, 6) })));
    setPromptsOpen(true);
  };

  const buildAgentChart = React.useCallback(
    (d: AgentChart) => (panel ? chartFromAgent(d, panel, lang, forecasts) ?? undefined : undefined),
    [panel, lang, forecasts],
  );

  // Fallback path (no agent): the client chart router grounds the answer with a
  // synthetic source the server rebuilds from the descriptor (US I1, #30).
  const prepare = React.useCallback((rq: string, sources: Source[]): { sources: Source[]; chart?: ChartPayload; synthetics?: SyntheticDescriptor[] } => {
    const res = panel ? chartForQuery(rq, panel, lang, forecasts) : null;
    const chart = res?.chart;
    const hist = localePath("/datos-historicos", lang) + "#historico";
    const shift = (xs: Source[]) => xs.map((s) => ({ ...s, n: s.n + 1 }));
    if (res?.grounding && chart) {
      sources = [{ n: 1, title: chart.title, source: panelSource(lang), url: hist, text: res.grounding.text, display: res.grounding.display, synthetic: true }, ...shift(sources)];
    } else if (chart?.kind === "table") {
      const text = monthTableText(chart as Extract<ChartSpec, { kind: "table" }>, lang);
      sources = [{ n: 1, title: `Visa Bulletin ${monthLabel(chart.month, lang)} · ${chart.tableType}`, source: panelSource(lang), url: hist, text, display: text, synthetic: true }, ...shift(sources)];
    } else if (chart?.kind === "bulletinDiff") {
      sources = [{ n: 1, title: chart.title, source: panelSource(lang), url: hist, text: bulletinDiffText(chart, lang), display: chartUserNote(chart, lang) ?? undefined, synthetic: true }, ...shift(sources)];
    } else if (chart) {
      const note = chartContextNote(chart, lang);
      if (note)
        sources = [{ n: 1, title: chart.title, source: lang === "en" ? "Live chart (real data panel)" : "Gráfico en vivo (panel de datos real)", url: localePath("/asistente", lang), text: note, display: chartUserNote(chart, lang) ?? undefined, synthetic: true }, ...shift(sources)];
    }
    const grounded = sources.some((s) => s.synthetic);
    return { sources, chart: chart || undefined, synthetics: res?.descriptor && grounded ? [res.descriptor] : undefined };
  }, [panel, lang, forecasts]);

  const {
    messages, setMessages, input, setInput, busy, send, stop, newChat, copy, copiedId,
    atBottom, setAtBottom, onScroll, scrollToBottom, scrollRef, inputRef, warm,
    semantic, constrained, enableSemantic, liveStatus,
  } = useVisabotChat({ lang, surface: "console", prepare, mergeFollowUp, buildAgentChart });

  const sendQ = React.useCallback((t: string) => {
    setNavOpen(false);
    void send(t);
    inputRef.current?.focus({ preventScroll: true });
  }, [send, inputRef]);

  React.useEffect(() => {
    warm();
    loadPanel().then(setPanel).catch(() => setPanelErr(true));
    loadForecasts().then(setForecasts).catch(() => {}).finally(() => setForecastsSettled(true));
    fetch("/rag/suggestions.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setSuggestions((d[lang]?.length ? d[lang] : d.es || d.en) || [])).catch(() => {});
    fetch("/rag/prompts.json").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPrompts((d[lang]?.length ? d[lang] : d.es || d.en) || [])).catch(() => {});
  }, [lang, warm]);

  // A question handed over from the home page (?q=) is sent once the data it
  // may need is ready (the panel AND the production forecasts — a forecast
  // chart built before they arrive falls back to the browser baseline), then
  // removed from the URL so a reload doesn't resend it.
  const handed = React.useRef(false);
  React.useEffect(() => {
    if (handed.current || (!panel && !panelErr) || !forecastsSettled) return;
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (!q) return;
    handed.current = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    sendQ(q.slice(0, 500));
  }, [panel, panelErr, forecastsSettled, sendQ]);

  const months = React.useMemo(() => (panel ? [...new Set(panel.rows.map((r) => r.bulletinMonth))].sort().reverse() : []), [panel]);
  React.useEffect(() => {
    if (!panel) return;
    if (!panel.countries.includes(country)) setCountry(panel.countries.includes("mexico") ? "mexico" : panel.countries[0]);
    if (!panel.categories.includes(category)) setCategory(panel.categories.includes("F3") ? "F3" : panel.categories[0]);
    if (!panel.tables.includes(table)) setTable(panel.tables.includes("FAD") ? "FAD" : panel.tables[0]);
    if (!month && months.length) setMonth(months[0]);
    if (!monthB && months.length) setMonthB(months[Math.min(12, months.length - 1)]); // ≈ a year earlier
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-click chart tools: drawn locally from the verified panel, no model call.
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
  const sidebarProps = {
    lang, panel, panelErr, kpis, months, suggestions, tools, runTool, onAsk: sendQ,
    country, setCountry, category, setCategory, table, setTable, month, setMonth, monthB, setMonthB,
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (promptsOpen) setPromptsOpen(false);
      else if (navOpen) setNavOpen(false);
      else setStage(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [promptsOpen, navOpen]);

  React.useEffect(() => (stage ? lockBodyScroll() : undefined), [stage]);

  const lastMsg = messages[messages.length - 1];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const followUps = !busy && panel && lastMsg?.role === "assistant" && lastMsg.content ? buildFollowUps(lastUserMsg, lang, panel) : [];

  const starters = [
    { id: "forecast", q: tr(lang, "acChip1") },
    { id: "priority", q: tr(lang, "acChip2") },
    { id: "compare", q: tr(lang, "acChip3") },
    { id: "changes", q: tr(lang, "acChip4") },
  ];
  const empty = messages.length === 0;

  return (
    <div id="asistente" ref={stageTrapRef} role={stage ? "dialog" : undefined} aria-modal={stage || undefined} aria-label={stage ? tr(lang, "acPresentationLabel") : undefined}
      data-vb-ready={(panel || panelErr) && forecastsSettled ? "true" : undefined}
      className={`vb-console ${stage ? "vb-stage" : ""} flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden bg-[var(--color-bg)]`}>
      <header className="vb-console-topbar flex w-full items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        {/* the panel: always a rail on desktop, a drawer on small screens and in presentation mode */}
        <button type="button" className={`vb-panel-toggle ${stage ? "" : "lg:hidden"}`} onClick={() => setNavOpen(true)} aria-label={tr(lang, "acPanelToggleLabel")} aria-expanded={navOpen} aria-haspopup="dialog">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> {tr(lang, "acPanelToggle")}
        </button>
        <h1 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">{tr(lang, "vbName")}</h1>
        <div className="flex-1" />
        {!empty && (
          <button onClick={newChat} className="vb-clearbtn" aria-label={tr(lang, "vbNewChat")} title={tr(lang, "vbNewChat")}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">{tr(lang, "vbNewChat")}</span>
          </button>
        )}
        {prompts.length > 0 && (
          <button onClick={openPrompts} className="vb-sq vb-ghost" aria-label={tr(lang, "acExamples")} title={tr(lang, "acExamples")}>
            <Lightbulb className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button type="button" onClick={() => setStage((v) => !v)} aria-pressed={stage} aria-label={tr(lang, stage ? "acExitPresentation" : "acPresentation")}
          title={tr(lang, stage ? "acExitPresentation" : "acPresentation")} className="vb-stage-toggle vb-sq vb-ghost">
          {stage ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
      {!stage && (
        <aside className="vb-controls-rail hidden w-[300px] shrink-0 border-r border-border lg:block" aria-label={tr(lang, "acTools")}>
          <AssistantSidebar sections="all" {...sidebarProps} />
        </aside>
      )}
      {navOpen && (
        <>
          <div className={`fixed inset-0 z-[65] bg-black/40 ${stage ? "" : "lg:hidden"}`} onClick={() => setNavOpen(false)} aria-hidden />
          <aside ref={navTrapRef} role="dialog" aria-modal="true" aria-label={tr(lang, "acTools")} className={`fixed inset-y-0 left-0 z-[66] w-[86%] max-w-[330px] bg-[var(--color-bg)] shadow-2xl ${stage ? "" : "lg:hidden"}`}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">{tr(lang, "acPanelToggle")}</span>
              <button className="vb-iconbtn" onClick={() => setNavOpen(false)} aria-label={tr(lang, "acCloseTools")}><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <div className="h-[calc(100%-3.25rem)]">
              <AssistantSidebar sections="all" {...sidebarProps} />
            </div>
          </aside>
        </>
      )}
      <div className="vb-conversation-pane relative flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="sr-only" role="status" aria-live="polite">{liveStatus}</p>
        <div ref={scrollRef} onScroll={onScroll} className="vb-thread flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-6" role="log" aria-live="off">
          <div className="vb-thread-inner mx-auto min-w-0 max-w-[820px] space-y-5">
            {empty ? (
              <div className="vb-empty">
                <p className="vb-empty-eyebrow">Visa Bulletin · {monthLabel(panel?.monthRange[1] || SITE_STATS.dateLast.slice(0, 7), lang)}</p>
                <h2 className="vb-empty-title">{tr(lang, "acEmptyTitle")}</h2>
                <p className="vb-empty-lead">{tr(lang, "acEmptyLead")}</p>
                <div className="vb-empty-chips">
                  {starters.map((s) => (
                    <button key={s.id} type="button" data-vb-starter={s.id} className="vb-start-card" onClick={() => sendQ(s.q)}>{s.q}</button>
                  ))}
                </div>
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
          <button onClick={scrollToBottom} aria-label={tr(lang, "vbScrollDown")} className="vb-sq absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--color-surface)] p-2 shadow-md">
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
        )}

        <SemanticConsent lang={lang} compact semantic={semantic} constrained={constrained} onEnable={() => enableSemantic()} />

        <div className="vb-composer px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <form onSubmit={(e) => { e.preventDefault(); sendQ(input); }} className="vb-composer-box mx-auto flex max-w-[820px] items-end gap-2">
            <textarea
              ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQ(input); } }}
              rows={1} placeholder={tr(lang, "vbPlaceholder")} aria-label={tr(lang, "vbPlaceholder")}
              className="vb-input max-h-40 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.95rem] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
            />
            {busy ? (
              <button type="button" onClick={stop} className="vb-sendbtn" aria-label={tr(lang, "vbStop")} title={tr(lang, "vbStop")}><Square className="h-4 w-4" aria-hidden /></button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="vb-sendbtn disabled:opacity-40" aria-label={tr(lang, "vbSend")} title={tr(lang, "vbSend")}><ArrowUp className="h-4 w-4" aria-hidden /></button>
            )}
          </form>
          <p className="vb-composer-hint">{tr(lang, "acComposerHint")}</p>
        </div>
      </div>
      </div>

      {promptsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={tr(lang, "acExamplesTitle")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setPromptsOpen(false)} aria-hidden />
          <div ref={promptsTrapRef} className="relative max-h-[85dvh] w-full max-w-[720px] overflow-y-auto overscroll-contain rounded-2xl bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{tr(lang, "acExamplesTitle")}</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-[var(--color-muted)]">{tr(lang, "acExamplesLead")}</p>
              </div>
              <button className="vb-iconbtn shrink-0" onClick={() => setPromptsOpen(false)} aria-label={tr(lang, "vbClose")}><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <div className="space-y-5">
              {promptsView.map((p) => {
                const Icon = PROMPT_ICON[p.icon] || BookOpen;
                return (
                  <div key={p.cat}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]"><Icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden /> {p.cat}</h3>
                    <div className="flex flex-wrap gap-2">
                      {p.items.map((q) => (
                        <button key={q} onClick={() => { setPromptsOpen(false); sendQ(q); track("VisaBot Example", { lang }); }} className="vb-suggest text-[0.82rem]">{q}</button>
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
