import type { Panel } from "@/lib/data/visa-panel";
import type { ForecastStore } from "@/lib/data/forecasts";
import type { AgentChart, ChartPayload, SyntheticDescriptor } from "@/components/visabot/types";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { priorityCheckSpec } from "./priority-check.mjs";
import { MONTHS_ES, MONTHS_EN } from "./synthetic-builders.mjs";
import {
  detectEntities, detectCountries, seriesCompareFacts, seriesCompareText, seriesCompareSummary,
  buildLine, buildCompare, buildMovement, buildStatus, buildMultiLine, buildHeatmap, buildRadar,
  buildForecast, buildMonthTable, parseMonth, buildBulletinDiff, parseTwoMonths,
} from "./analytics";
const blockOf = (cat: string) => (/^F/i.test(cat) ? "familia" : "empleo");

// A chart for the query PLUS the structured descriptor the server rebuilds its
// grounding text from (US I1, #30). The descriptor carries identifiers/months
// only — never prose, never figures; the proxy recomputes the text from
// hash-verified release data with the SAME shared builders.
// `grounding` carries a table-shaped note built here with the same shared
// builder the server uses (the server never takes this text, only the descriptor).
type ChartAndDescriptor = { chart: ChartPayload; descriptor?: SyntheticDescriptor; grounding?: { text: string; display: string } };

export function chartForQuery(q: string, panel: Panel, lang: "es" | "en", forecasts: ForecastStore | null): ChartAndDescriptor | null {
  const e = detectEntities(q, panel);
  const t = e.table || "FAD";
  const rid = SITE_STATS.releaseId;
  const wrap = (chart: ChartPayload | null, descriptor: SyntheticDescriptor): ChartAndDescriptor | null =>
    chart ? { chart, descriptor } : null;
  // Two or more countries on one category ("compara México F2A con India F2A"):
  // a race of just those countries, grounded with each one's real cutoffs and
  // forecast. Checked first, so the forecast and single-series branches below
  // can't take only the first country.
  const named = detectCountries(q).filter((c) => panel.countries.includes(c));
  if (named.length >= 2 && e.category) {
    const facts = seriesCompareFacts(panel, named, e.category, t, forecasts);
    const chart = facts && buildMultiLine(panel, e.category, t, lang, forecasts, facts.countries);
    if (facts && chart)
      return { chart, descriptor: { kind: "series_compare", countries: facts.countries, category: e.category, table: t, release_id: rid },
        grounding: { text: seriesCompareText(facts, lang), display: seriesCompareSummary(facts, lang) } };
  }
  // Forecast intent — the CORE purpose of the project. Catches the explicit words AND the
  // NATURAL way people ask for a prediction ("¿cuándo llega mi turno?", "en qué mes/año",
  // "cuánto falta", "when will I be current?"), incl. when the user states their priority
  // date. Checked FIRST so "tabla de asignación" in such a question doesn't hijack it.
  const explicitForecast = /\b(?:predic\w*|pron[oó]stic\w*|forecasts?|proyecci[oó]n\w*|projections?|predict\w*|futuro|zoom|abanico|fan[ -]?chart|estimaci[oó]n)\b/i.test(q);
  const historical = /\b(?:retrocedio|avanzo|hubo|historic\w*|latest|ultimo|most recent|did|was|happened)\b/i.test(q.normalize("NFD").replace(/[̀-ͯ]/g, "")) || /fecha de prioridad tiene|cutoff.*latest/i.test(q);
  const wantsForecast = explicitForecast || (!historical && (
    /cu[aá]ndo|cu[aá]nto\s+(falta|tiempo|tardar|me)|qu[eé]\s+(mes|a[ñn]o|fecha)|mi\s+turno|me\s+toca|llegar[aá]?|alcanz|ponerse al d[ií]a|al corriente/i.test(q) ||
    /when|how long|my turn|be current|get current|catch up|reach my|my priority date/i.test(q)));
  if (wantsForecast && e.category) {
    const country = e.country || "mexico";
    // horizon derived from the shipped forecasts (regla #0); 12 only as the
    // drift-fallback default inside buildForecast when no store loaded.
    return wrap(
      buildForecast(panel, country, e.category, t, lang, forecasts?.horizonMonths || undefined, 48, forecasts),
      { kind: "forecast_note", country, category: e.category, table: t, release_id: rid },
    );
  }
  // Compare two bulletins: needs TWO months, checked BEFORE the single-month
  // table branch (so "compara el boletín de X con Y" isn't hijacked by "boletín").
  if (/compar|versus|\bvs\b|diferencia|difference|contra|frente a|cambi[oó]|changed?/i.test(q)) {
    let mm = parseTwoMonths(q, panel);
    const bulletinIntent = /\b(?:bolet[ií]n|boletines|bulletins?)\b/i.test(q);
    if (!mm && bulletinIntent) {
      const months = [...new Set(panel.rows.filter(r => r.table === t).map(r => r.bulletinMonth))].sort();
      const explicitDate = /\b(?:19|20)\d{2}\b/.test(q) || [...MONTHS_ES, ...MONTHS_EN].some(m => new RegExp(`\\b${m}\\b`, "i").test(q));
      const target = parseMonth(q, panel) ?? (!explicitDate ? months.at(-1) : null);
      const at = target ? months.indexOf(target) : -1;
      if (at > 0) mm = [months[at - 1], months[at]];
      if (!mm) return null;
    }
    if (mm)
      return wrap(buildBulletinDiff(panel, mm[0], mm[1], t, lang),
        { kind: "bulletin_diff", monthA: mm[0], monthB: mm[1], table: t, release_id: rid });
  }
  // Monthly bulletin snapshot: "tabla/boletín de <mes>" → full-history snapshot. Only when
  // it is NOT a forecast question (guarded above), so the word "tabla" can't hijack it.
  if (!wantsForecast && /\btabla\b|\bbolet[ií]n\b|\bbulletins?\b|\btable\b|snapshot/i.test(q)) {
    const m = parseMonth(q, panel);
    if (m) return wrap(buildMonthTable(panel, m, t, lang), { kind: "month_table", month: m, table: t, release_id: rid });
  }
  const move = /movimiento|retroce[sd]|avanc|avanz|movement|retrogress|advanc/i.test(q);
  const status = /estado|current|disponib|status|r[eé]gimen|c\/f\/u/i.test(q);
  if (/mapa de calor|matriz|heatmap|matrix/i.test(q)) {
    const block = e.block || (e.category ? blockOf(e.category) : "familia");
    return wrap(buildHeatmap(panel, block, t, lang), { kind: "chart_note", chart: "heatmap", block, table: t, release_id: rid });
  }
  if (/radar|huella|fingerprint/i.test(q))
    return wrap(buildRadar(panel, t, lang), { kind: "chart_note", chart: "radar", table: t, release_id: rid });
  if (/carrera|todos los pa[ií]s|all countr|cada pa[ií]s|\brace\b/i.test(q) && e.category)
    return wrap(buildMultiLine(panel, e.category, t, lang, forecasts),
      { kind: "chart_note", chart: "multiline", category: e.category, table: t, release_id: rid });
  if (e.country && e.category) {
    if (move)
      return wrap(buildMovement(panel, e.country, e.category, t, lang),
        { kind: "chart_note", chart: "movement", country: e.country, category: e.category, table: t, release_id: rid });
    if (status)
      return wrap(buildStatus(panel, lang, { country: e.country, category: e.category, table: t }),
        { kind: "chart_note", chart: "status", country: e.country, category: e.category, table: t, release_id: rid });
    return wrap(buildLine(panel, e.country, e.category, t, lang),
      { kind: "chart_note", chart: "line", country: e.country, category: e.category, table: t, release_id: rid });
  }
  if (e.category)
    return wrap(buildCompare(panel, e.category, t, lang),
      { kind: "chart_note", chart: "compare", category: e.category, table: t, release_id: rid });
  if (e.country && status)
    return wrap(buildStatus(panel, lang, { country: e.country }),
      { kind: "chart_note", chart: "status", country: e.country, release_id: rid });
  return null;
}



// The chart the agent asked for (server show_chart / check_priority_date),
// rebuilt here from the same release data with the shared builders. Returns
// null when the descriptor does not resolve to a drawable chart.
export function chartFromAgent(d: AgentChart, panel: Panel, lang: "es" | "en", forecasts: ForecastStore | null): ChartPayload | null {
  const t = d.table === "DFF" ? "DFF" : "FAD";
  const { country, category } = d;
  switch (d.kind) {
    case "forecast":
      return country && category ? buildForecast(panel, country, category, t, lang, forecasts?.horizonMonths || undefined, 48, forecasts) : null;
    case "history":
      return country && category ? buildLine(panel, country, category, t, lang) : null;
    case "movement":
      return country && category ? buildMovement(panel, country, category, t, lang) : null;
    case "compare_countries":
      return category && d.countries?.length ? buildMultiLine(panel, category, t, lang, forecasts, d.countries) : null;
    case "bulletin_table":
      return d.month ? buildMonthTable(panel, d.month, t, lang) : null;
    case "bulletin_diff":
      return d.month && d.month_b ? buildBulletinDiff(panel, d.month, d.month_b, t, lang) : null;
    case "priority_check": {
      const spec = priorityCheckSpec({ priorityDate: d.priority_date ?? null, country: country ?? null, category: category ?? null, table: t }, panel, forecasts, lang);
      // A stale local panel must never contradict the server's verified comparison.
      if (d.result !== undefined && (spec.result !== d.result || (spec.cutoff ?? null) !== (d.cutoff ?? null))) return null;
      return spec;
    }
    default:
      return null;
  }
}
