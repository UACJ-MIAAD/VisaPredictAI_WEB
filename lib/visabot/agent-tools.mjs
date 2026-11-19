// VisaBot agent tools — the ONLY way the model reads data.
//
// The model no longer receives prose templates chosen by a client-side regex
// router; it asks for exactly what it needs and every answer comes from the
// hash-verified release artifacts the Netlify function already loads
// (synthetic-context.mjs → { panel, store }). Each tool returns plain facts
// (ISO dates, counts, statuses) with no instructions inside, so nothing a tool
// says can be mistaken for an order, and a date the model writes can be
// audited against what the tools actually returned (auditDates below).
//
// Pure module: no network, no SDK. chat.mjs injects the verified data, a doc
// search function (hash-checked RAG chunks) and the surface; tests drive the
// executors directly.

import { countryLabel, PILOT } from "../data/panel-core.mjs";
import { forecastFor, forecastMetaFor, backfillScored } from "../data/forecasts-core.mjs";
import {
  isoDays, epochToDate, monthLabel, buildMonthTable, monthTableText, buildBulletinDiff,
  bulletinDiffFacts, seriesCompareFacts, seriesCompareSummary, chartTitle,
} from "./synthetic-builders.mjs";
import { priorityCheckSpec, priorityCheckSummary, validPriorityDate } from "./priority-check.mjs";

const TABLES = ["FAD", "DFF"];
const MONTH_RX = /^\d{4}-(0[1-9]|1[0-2])$/;
const CHART_KINDS = ["forecast", "history", "movement", "compare_countries", "bulletin_table", "bulletin_diff"];

// ── tool schemas (Anthropic tool format) ────────────────────────────────────
const SERIES = {
  country: { type: "string", enum: PILOT, description: "Country or chargeability area code. all_chargeability = 'All Chargeability Areas Except Those Listed' (rest of the world)." },
  category: { type: "string", description: "Preference category code exactly as in the bulletin: F1, F2A, F2B, F3, F4, EB1, EB2, EB3, EB3_OW, EB4, EB4_RW, EB5_UNRESERVED, EB5_RURAL, EB5_HIGHUNEMP, EB5_INFRA, …" },
  table: { type: "string", enum: TABLES, description: "FAD = Final Action Dates (Table A, final adjudication). DFF = Dates for Filing (Table B, when an application may be filed). Default FAD." },
};
const req = (...k) => k;

export function toolDefinitions(surface) {
  const tools = [
    {
      name: "get_series",
      description: "History of one series (country × category × table): latest published status and cutoff, the last 12 bulletins, one snapshot per year for the last 15 years, and descriptive pace statistics (how many days the cutoff advanced over 1, 5 and 10 years, frozen months, retrogressions). Use it for 'what is the current cutoff', 'why is it so slow', 'how has it moved'. History only, never a forecast.",
      input_schema: { type: "object", properties: { ...SERIES }, required: req("country", "category", "table"), additionalProperties: false },
    },
    {
      name: "get_forecast",
      description: "Production-model forecast for one series: last real cutoff and the monthly projected cutoff with 80% and 95% prediction intervals for every month of the published horizon, the series' hold-out MASE and the global prospective track record. Nothing exists beyond the published horizon.",
      input_schema: { type: "object", properties: { ...SERIES }, required: req("country", "category", "table"), additionalProperties: false },
    },
    {
      name: "check_priority_date",
      description: "Exact comparison of a user's priority date with the latest published cutoff of one series (current / equal / not yet / Current table / Unavailable), the gap in days, the series' historical pace and, if the date is not yet current, the first month the model's central path passes it within the published horizon. Call this whenever the user gives their own priority date. Convert the user's words to an ISO date first (if they gave only month and year, use day 01 and say so).",
      input_schema: {
        type: "object",
        properties: { ...SERIES, priority_date: { type: "string", description: "The user's priority date as YYYY-MM-DD." } },
        required: req("country", "category", "table", "priority_date"), additionalProperties: false,
      },
    },
    {
      name: "get_bulletin",
      description: "One full published bulletin table (all categories × the five pilot countries/areas) for a given month and table. Months available: the panel range given in the system prompt.",
      input_schema: {
        type: "object",
        properties: { month: { type: "string", description: "Bulletin month as YYYY-MM." }, table: SERIES.table },
        required: req("month", "table"), additionalProperties: false,
      },
    },
    {
      name: "compare_bulletins",
      description: "What changed between two bulletins of the same table: counts of advances, retrogressions and status changes, the biggest movements, and every cell from→to.",
      input_schema: {
        type: "object",
        properties: { month_a: { type: "string", description: "YYYY-MM" }, month_b: { type: "string", description: "YYYY-MM" }, table: SERIES.table },
        required: req("month_a", "month_b", "table"), additionalProperties: false,
      },
    },
    {
      name: "compare_countries",
      description: "Side-by-side comparison of two to five countries/areas on one category and table: current cutoff, the cutoff 12 bulletins earlier, the change in days and the production forecast at the end of the horizon with its 95% band.",
      input_schema: {
        type: "object",
        properties: { countries: { type: "array", items: SERIES.country, minItems: 2, maxItems: 5 }, category: SERIES.category, table: SERIES.table },
        required: req("countries", "category", "table"), additionalProperties: false,
      },
    },
    {
      name: "search_docs",
      description: "Search the project's documentation: the thesis proposal (methodology, CRISP-DM, objectives), glossary of Visa Bulletin terms, data dictionary, the deployed model card (champion model, MASE, MCS, coverage), MLOps notes and references. Use it for definitions and for anything about the models, metrics, data pipeline or the project itself.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "A focused search query (Spanish or English)." } },
        required: req("query"), additionalProperties: false,
      },
    },
  ];
  if (surface === "console")
    tools.push({
      name: "show_chart",
      description: "Display ONE chart next to your answer in the console. kinds: forecast (fan chart with prediction bands; needs country, category, table), history (cutoff over time; country, category, table), movement (monthly advance/retrogression bars; country, category, table), compare_countries (several countries on one category; countries, category, table), bulletin_table (a full bulletin; month, table), bulletin_diff (two bulletins side by side; month, month_b, table). Show a chart when it helps the user see the answer; at most one per answer, and only describe a chart you actually displayed.",
      input_schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: CHART_KINDS },
          country: SERIES.country, category: SERIES.category, table: SERIES.table,
          countries: { type: "array", items: SERIES.country, minItems: 2, maxItems: 5 },
          month: { type: "string", description: "YYYY-MM" }, month_b: { type: "string", description: "YYYY-MM" },
        },
        required: req("kind"), additionalProperties: false,
      },
    });
  return tools;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const monthsBack = (m, k) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + mo - 1 - k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const cellOf = (r) => (!r ? "—" : r.status === "C" ? "C (Current)" : r.status === "U" ? "U (Unavailable)" : r.priorityDate || "—");
const isF = (r) => r?.status === "F" && r.priorityDate && r.daysSinceBase != null;

class ToolError extends Error {}

function seriesRows(panel, country, category, table) {
  if (!PILOT.includes(country)) throw new ToolError(`unknown country "${country}"; valid: ${PILOT.join(", ")}`);
  if (!TABLES.includes(table)) throw new ToolError(`unknown table "${table}"; valid: FAD, DFF`);
  if (!panel.categories.includes(category))
    throw new ToolError(`unknown category "${category}"; valid: ${panel.categories.join(", ")}`);
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table)
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  if (!rows.length) throw new ToolError(`no published observations for ${country} ${category} ${table}`);
  return rows;
}

const seriesName = (country, category, table, lang) => `${countryLabel(country, lang)} · ${category} · ${table}`;

// Descriptive pace over the last k months, measured between dated (F) rows.
// History, not a projection: the agent prompt forbids turning it into a date.
export function paceFacts(rows) {
  const dated = rows.filter(isF);
  const last = dated.at(-1);
  if (!last) return null;
  const out = { last: { month: last.bulletinMonth, cutoff: last.priorityDate }, windows: [] };
  for (const k of [12, 60, 120]) {
    const target = monthsBack(last.bulletinMonth, k);
    const then = dated.findLast((r) => r.bulletinMonth <= target);
    if (!then || then === last) continue;
    const span = (isoDays(`${last.bulletinMonth}-01`) - isoDays(`${then.bulletinMonth}-01`)) / 365.25;
    const adv = last.daysSinceBase - then.daysSinceBase;
    out.windows.push({ months: k, from: then.bulletinMonth, fromCutoff: then.priorityDate, advanceDays: adv, daysPerYear: Math.round(adv / span) });
  }
  let frozen = 0, moves = 0, retro = 0, worst = null;
  const recent = dated.slice(-25);
  for (let i = 1; i < recent.length; i++) if (recent[i].daysSinceBase === recent[i - 1].daysSinceBase) frozen++;
  for (let i = 1; i < dated.length; i++) {
    const d = dated[i].daysSinceBase - dated[i - 1].daysSinceBase;
    moves++;
    if (d < 0) { retro++; if (!worst || d < worst.days) worst = { month: dated[i].bulletinMonth, days: d }; }
  }
  out.frozenOfLast24 = Math.max(0, recent.length - 1) ? `${frozen} of ${recent.length - 1}` : "n/a";
  out.retrogressions = retro;
  out.transitions = moves;
  out.worstRetrogression = worst;
  return out;
}

function paceLines(p) {
  if (!p) return ["Pace: no dated cutoffs in this series."];
  const lines = p.windows.map((w) =>
    `- last ${w.months / 12 >= 1 ? `${w.months / 12} year(s)` : `${w.months} months`} (since bulletin ${w.from}, cutoff then ${w.fromCutoff}): advanced ${w.advanceDays} days ≈ ${w.daysPerYear} days of priority dates per calendar year`);
  lines.push(`- unchanged month-to-month in ${p.frozenOfLast24} of the latest dated transitions`);
  lines.push(`- retrogressions in the whole series: ${p.retrogressions} of ${p.transitions} transitions${p.worstRetrogression ? `; worst ${p.worstRetrogression.days} days in bulletin ${p.worstRetrogression.month}` : ""}`);
  return ["Historical pace (descriptive, not a forecast):", ...lines];
}

function forecastBlock(store, rows, country, category, table) {
  const fc = forecastFor(store ?? null, country, category, table);
  const lastF = rows.findLast(isF);
  if (store?.status === "production_unavailable") return { ok: false, text: "Production forecast feed is unavailable right now; no projection can be given." };
  if (!fc?.length || !lastF) return { ok: false, text: "No production forecast is published for this exact series." };
  const base = isoDays(lastF.priorityDate) - lastF.daysSinceBase;
  const d = (x) => epochToDate(base + x);
  const meta = forecastMetaFor(store, country, category, table);
  const lines = fc.map((p) => `- ${p.date.slice(0, 7)}: central ${d(p.days)} · 80% [${d(p.lo80)}, ${d(p.hi80)}] · 95% [${d(p.lo95)}, ${d(p.hi95)}]`);
  const head = [
    `Model: ${meta?.models?.length ? meta.models.join("+") : store?.method?.[table] ?? "production model"}${meta && Number.isFinite(meta.mase) ? ` · hold-out MASE of this series ${meta.mase}` : ""}`,
    `Published horizon: ${fc.length} months (${fc[0].date.slice(0, 7)} to ${fc.at(-1).date.slice(0, 7)}). No projection exists after ${fc.at(-1).date.slice(0, 7)}.`,
  ];
  const sc = store?.scorecard;
  if (sc) {
    const maeAt = (k) => { const v = sc.by_horizon?.[String(k)]?.mae_days; return Number.isFinite(v) ? `${Math.round(v)} d at ${k} mo` : null; };
    const errs = [1, 3, 6, 12].map(maeAt).filter(Boolean);
    const n = backfillScored(sc);
    const cov = Number.isFinite(sc.overall?.cov95) ? `${Math.round(sc.overall.cov95 * 100)}%` : null;
    head.push(`Global track record across all series (${n != null ? `${n} ` : ""}backfilled forecasts scored against later bulletins; indicative): mean absolute error ${errs.join(", ")}${cov ? `; the 95% interval contained the real cutoff in ${cov} of cases` : ""}.`);
  }
  return { ok: true, text: [...head, "Monthly projection (prediction intervals):", ...lines].join("\n"), fc, base };
}

// ── executors ───────────────────────────────────────────────────────────────
// Each returns { title, text, chart? }. `text` is what the model reads (facts
// only); `chart` is the descriptor the console renders (show_chart only).
const EXEC = {
  get_series({ country, category, table }, { panel, lang }) {
    const rows = seriesRows(panel, country, category, table);
    const last = rows.at(-1);
    const recent = rows.slice(-12).map((r) => `- ${r.bulletinMonth}: ${cellOf(r)}`);
    const yearly = [];
    for (let y = 1; y <= 15; y++) {
      const m = monthsBack(last.bulletinMonth, 12 * y);
      const r = rows.find((x) => x.bulletinMonth === m);
      if (r) yearly.push(`- ${m}: ${cellOf(r)}`);
    }
    return {
      title: seriesName(country, category, table, lang),
      text: [
        `Series ${seriesName(country, category, table, "en")}. Bulletins in panel: ${rows[0].bulletinMonth} to ${last.bulletinMonth} (${rows.length}).`,
        `Latest bulletin ${last.bulletinMonth}: ${cellOf(last)}.`,
        "Last 12 bulletins:", ...recent,
        yearly.length ? "Same month in earlier years:" : "", ...yearly,
        ...paceLines(paceFacts(rows)),
      ].filter(Boolean).join("\n"),
    };
  },

  get_forecast({ country, category, table }, { panel, store, lang }) {
    const rows = seriesRows(panel, country, category, table);
    const last = rows.at(-1);
    const f = forecastBlock(store, rows, country, category, table);
    return {
      title: `${lang === "en" ? "Forecast" : "Pronóstico"} · ${seriesName(country, category, table, lang)}`,
      text: [`Series ${seriesName(country, category, table, "en")}. Latest bulletin ${last.bulletinMonth}: ${cellOf(last)}.`, f.text].join("\n"),
    };
  },

  check_priority_date({ country, category, table, priority_date }, { panel, store, lang }) {
    if (!validPriorityDate(priority_date)) throw new ToolError(`priority_date must be a real calendar date YYYY-MM-DD, got "${priority_date}"`);
    const rows = seriesRows(panel, country, category, table);
    const spec = priorityCheckSpec({ priorityDate: priority_date, country, category, table }, panel, store, lang);
    const lines = [priorityCheckSummary(spec, lang).replace(/\*\*/g, "")];
    const lastF = rows.findLast(isF);
    if (lastF && spec.result === "after") {
      const gap = isoDays(priority_date) - isoDays(lastF.priorityDate);
      lines.push(`Gap between the user's date and the latest dated cutoff (${lastF.priorityDate}): ${gap} days (${(gap / 365.25).toFixed(1)} years of priority dates).`);
    }
    lines.push(...paceLines(paceFacts(rows)));
    return { title: spec.title, text: lines.join("\n"), chart: { kind: "priority_check", country, category, table, priority_date } };
  },

  get_bulletin({ month, table }, { panel, lang }) {
    if (!MONTH_RX.test(month || "")) throw new ToolError("month must be YYYY-MM");
    if (!TABLES.includes(table)) throw new ToolError("table must be FAD or DFF");
    const spec = buildMonthTable(panel, month, table, lang);
    if (!spec) throw new ToolError(`no ${table} bulletin for ${month}; panel range ${panel.monthRange[0]} to ${panel.monthRange[1]}`);
    return { title: spec.title, text: monthTableText(spec, "en") };
  },

  compare_bulletins({ month_a, month_b, table }, { panel, lang }) {
    if (!MONTH_RX.test(month_a || "") || !MONTH_RX.test(month_b || "")) throw new ToolError("months must be YYYY-MM");
    const spec = buildBulletinDiff(panel, month_a, month_b, table, lang);
    if (!spec) throw new ToolError(`cannot compare ${month_a} and ${month_b} (${table}); panel range ${panel.monthRange[0]} to ${panel.monthRange[1]}`);
    return { title: spec.title, text: bulletinDiffFacts(spec, "en") };
  },

  compare_countries({ countries, category, table }, { panel, store, lang }) {
    const list = [...new Set(Array.isArray(countries) ? countries : [])];
    list.forEach((c) => seriesRows(panel, c, category, table));
    const spec = seriesCompareFacts(panel, list, category, table, store);
    if (!spec) throw new ToolError("need at least two countries with data for this category and table");
    return { title: chartTitle("countries", spec, lang) || `${category} · ${table}`, text: seriesCompareSummary(spec, "en") };
  },

  async search_docs({ query }, { docs, lang }) {
    if (typeof query !== "string" || !query.trim()) throw new ToolError("query is required");
    const hits = docs ? await docs(query.slice(0, 300), lang) : [];
    if (!hits.length) return { title: lang === "en" ? "Documentation search" : "Búsqueda en la documentación", text: "No matching documentation found.", empty: true };
    return { hits };
  },

  show_chart(input, { panel, lang }) {
    const { kind, country, category, table = "FAD", countries, month, month_b } = input;
    if (!CHART_KINDS.includes(kind)) throw new ToolError(`kind must be one of ${CHART_KINDS.join(", ")}`);
    if (["forecast", "history", "movement"].includes(kind)) seriesRows(panel, country, category, table);
    if (kind === "compare_countries") {
      if (!Array.isArray(countries) || countries.length < 2) throw new ToolError("compare_countries needs two or more countries");
      countries.forEach((c) => seriesRows(panel, c, category, table));
    }
    if (kind === "bulletin_table" && !buildMonthTable(panel, month, table, lang)) throw new ToolError(`no ${table} bulletin for ${month}`);
    if (kind === "bulletin_diff" && !buildBulletinDiff(panel, month || "", month_b || "", table, lang)) throw new ToolError(`cannot compare ${month} and ${month_b}`);
    const chart = { kind, table, ...(country ? { country } : {}), ...(category ? { category } : {}), ...(countries ? { countries: [...new Set(countries)] } : {}), ...(month ? { month } : {}), ...(month_b ? { month_b } : {}) };
    return { title: null, text: `Chart displayed to the user: ${kind}${country ? ` ${country}` : ""}${countries ? ` ${countries.join("/")}` : ""}${category ? ` ${category}` : ""} ${table}${month ? ` ${month}` : ""}${month_b ? `→${month_b}` : ""}.`, chart, silent: true };
  },
};

// Runs one tool call. Never throws: a bad input or an unknown tool becomes an
// is_error result the model can correct, so one slip does not end the answer.
export async function runTool(name, input, ctx) {
  const fn = EXEC[name];
  if (!fn || (name === "show_chart" && ctx.surface !== "console"))
    return { error: true, text: `Unknown tool ${name}.` };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: true, text: "Tool input must be an object." };
  try {
    return await fn(input, ctx);
  } catch (e) {
    if (e instanceof ToolError) return { error: true, text: e.message };
    return { error: true, text: "The data for this request could not be read." };
  }
}

// ── date audit ──────────────────────────────────────────────────────────────
// A full calendar date the model writes must appear in what it was given
// (tool results, sources or the user's own messages). Month-year phrases are
// not audited: they are too often legitimate paraphrase ("abril de 2001").
const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
const MES_RX = Object.keys(MES).sort((a, b) => b.length - a.length).join("|");
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const BULLETIN_MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

export function extractDates(text) {
  const out = new Set();
  const t = String(text);
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.add(iso(m[1], +m[2], +m[3]));
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${MES_RX})\\.?,?\\s+(?:de\\s+|del\\s+)?(\\d{4})\\b`, "gi")))
    out.add(iso(m[3], MES[m[2].toLowerCase()], +m[1]));
  for (const m of t.matchAll(new RegExp(`\\b(${MES_RX})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi")))
    out.add(iso(m[3], MES[m[1].toLowerCase()], +m[2]));
  for (const m of t.matchAll(/\b(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})\b/g)) {
    const yy = +m[3];
    out.add(iso(yy > 50 ? 1900 + yy : 2000 + yy, BULLETIN_MON[m[2]], +m[1]));
  }
  return [...out].filter((d) => validPriorityDate(d));
}

export function auditDates(answer, groundTexts) {
  const known = new Set(groundTexts.flatMap(extractDates));
  return extractDates(answer).filter((d) => !known.has(d));
}

export { ToolError, monthLabel };
