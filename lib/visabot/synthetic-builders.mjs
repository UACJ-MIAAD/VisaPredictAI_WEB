// US I1 (PENDIENTES #30) — SINGLE SOURCE of the VisaBot synthetic-context
// builders: the month-table, bulletin-comparison and forecast grounding texts
// plus every chart title. Imported by BOTH sides:
//   • the browser (lib/visabot/analytics.ts re-exports this surface) to render
//     charts and show the citation chips, and
//   • the Netlify chat function (netlify/functions/chat.mjs via
//     lib/visabot/synthetic-context.mjs) to RECOMPUTE the exact same text from
//     hash-verified release data before it reaches the LLM.
// Because both sides run this very code over the same released artifacts, the
// server-rebuilt table matches the client's cell by cell — and a client can no
// longer smuggle invented figures: the server never reads numbers from it.
//
// Plain ESM on purpose (repo convention: retrieval-core.mjs, panel-core.mjs);
// types live in synthetic-builders.d.mts. Do NOT re-implement any of these
// templates elsewhere — chat.mjs validates its own rebuilt output against the
// template grammar (TABLE_HEADERS/ROW_RX/NOTE_SKELETONS), so a divergent copy
// would fail closed in production.

import { countryLabel, PILOT } from "../data/panel-core.mjs";
import { forecastFor, forecastMetaFor } from "../data/forecasts-core.mjs";

// ── shared domain constants ─────────────────────────────────────────────────
export const FAM = ["F1", "F2A", "F2B", "F3", "F4"];
export const EMP = ["EB1", "EB2", "EB3", "EB4", "EB5"];
// Category display order for month tables and bulletin diffs (mirrored by the
// gallery's CAT_ORDER). Single copy — both builders sort with it.
export const CAT_ORDER_FULL = [...FAM, "EB1", "EB2", "EB3", "EB3_OW", "EB4", "EB4_RW", "EB4_TRANS", "EB5", "EB5_UNRESERVED", "EB5_RURAL", "EB5_HIGHUNEMP", "EB5_INFRA", "EB5_NONRC", "EB5_TEA", "EB5_PILOT", "EB5_RC"];

// ── date helpers ────────────────────────────────────────────────────────────
export const monthDays = (m) => { const [y, mo] = m.split("-").map(Number); return Date.UTC(y, mo - 1, 1) / 86400000; };
export const isoDays = (d) => { const [y, mo, da] = d.split("-").map(Number); return Date.UTC(y, mo - 1, da || 1) / 86400000; };
// Decimal year of a priority date. Uses the SAME days→year transform as the
// forecast points (epochToYear = 1970 + days/365.25) so the history line and the
// projection meet continuously at the split (P3: history divided the day by 365
// and the month by 12, while forecast points used /365.25 — a visible kink).
export const pdYear = (d) => 1970 + isoDays(d) / 365.25;

const Z80 = 1.2816, Z95 = 1.96, DAYS_Y = 365.25;
export const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
export const epochToYear = (e) => 1970 + e / DAYS_Y;
export const epochToDate = (e) => { const d = new Date(e * 86400000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

const seriesTitle = (e) => `${countryLabel(e.country)} · ${e.category} · ${e.table}`;

// ── chart titles (single source — analytics.ts builders AND the server-side
// generic chart-note rebuild derive titles from here, so a descriptor can be
// re-titled on the server without duplicating any string) ────────────────────
export function chartTitle(kind, p, lang) {
  switch (kind) {
    case "line":
      return seriesTitle(p);
    case "compare":
      return lang === "en" ? `Backlog by country · ${p.category} · ${p.table}` : `Espera por país · ${p.category} · ${p.table}`;
    case "movement":
      return lang === "en" ? `Monthly movement · ${seriesTitle(p)}` : `Movimiento mensual · ${seriesTitle(p)}`;
    case "status": {
      const scope = p.country || p.category || p.table
        ? [p.country ? countryLabel(p.country) : null, p.category, p.table].filter(Boolean).join(" · ")
        : (lang === "en" ? "whole panel" : "todo el panel");
      return lang === "en" ? `Status mix · ${scope}` : `Mezcla de estado · ${scope}`;
    }
    case "multiline":
      return lang === "en" ? `Priority-date race · ${p.category} · ${p.table}` : `Carrera de fechas · ${p.category} · ${p.table}`;
    case "heatmap":
      return lang === "en"
        ? `Wait heatmap · ${p.block === "empleo" ? "employment" : "family"} · ${p.table}`
        : `Mapa de calor de espera · ${p.block === "empleo" ? "empleo" : "familia"} · ${p.table}`;
    case "radar":
      return lang === "en" ? `Wait fingerprint by country · ${p.table}` : `Huella de espera por país · ${p.table}`;
    case "forecast":
      return lang === "en" ? `Forecast · ${seriesTitle(p)}` : `Pronóstico · ${seriesTitle(p)}`;
    default:
      return null;
  }
}

// Generic grounding note for the non-table charts (the title is the only slot;
// on the server it is rebuilt via chartTitle, never taken from the client).
export function genericChartNote(title, lang) {
  return lang === "en"
    ? `A chart titled "${title}" is being rendered to the user from the real data panel — reference and interpret it; do NOT say you cannot show charts.`
    : `Se está mostrando al usuario un gráfico titulado «${title}» generado con el panel de datos real — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos.`;
}

// ── forecast (the project's whole point) ────────────────────────────────────
// In-browser baseline: local-drift trend over the recent Final-status window,
// with a random-walk prediction interval that widens with the horizon. This is
// one of the project's own reference models (naïve drift / Theta family); the
// full evaluation also compares SARIMA, ETS and deep models. Real data only,
// no fabricated cutoffs — clearly labelled as an illustrative projection.

// Band cells in the forecast data are typed `[number, number] | null` because
// history rows carry no band — but the projected points always do (both the
// production and the drift paths write them). Narrow once here instead of
// scattering casts; a (theoretically impossible) null degrades to NaN bounds,
// which render as "NaN" instead of throwing.
export const bandOf = (b) => b ?? [NaN, NaN];

// ── drift-baseline primitives (pure; exported for unit tests) ───────────────
// OLS regression of the series on its observation index 0..n-1. `slope` is the
// per-month drift, `sigma` the residual std-dev (n−2 dof), `last` the final
// observed value — the anchor every projected point extends from.
export function fitDrift(ys) {
  const n = ys.length;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (i - mx) ** 2; sxy += (i - mx) * (ys[i] - my); }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (ys[i] - (intercept + slope * i)) ** 2;
  const sigma = Math.sqrt(ss / Math.max(1, n - 2));
  return { slope, sigma, last: ys[n - 1] };
}

// Point + 80/95 % bands at horizon h (months ahead). The half-width grows with
// √h — the random-walk spread of THIS illustrative in-browser baseline (its
// own documented method; the production bands ship pre-computed with
// per-horizon empirical quantiles and never go through here).
export function driftBands(fit, h) {
  const point = fit.last + fit.slope * h, half = fit.sigma * Math.sqrt(h);
  return { point, lo80: point - Z80 * half, hi80: point + Z80 * half, lo95: point - Z95 * half, hi95: point + Z95 * half };
}

export function buildForecast(panel, country, category, table, lang, horizon = 12, window = 48, forecasts, index) {
  // When a pre-built index is supplied (gallery: many cards over one panel), use
  // the O(1) slice instead of scanning all panel.rows per call. Same rows, sorted.
  const series = index?.get(`${country}|${category}|${table}`) ??
    panel.rows
      .filter((r) => r.country === country && r.category === category && r.table === table)
      .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  const fobs = series.filter((r) => r.status === "F" && r.daysSinceBase != null && r.priorityDate);
  if (fobs.length < 8) return null; // too short to anchor an honest forecast

  const win = fobs.slice(-Math.max(window, 12));
  const last = win[win.length - 1];
  const baseEpoch = isoDays(last.priorityDate) - last.daysSinceBase; // → base epoch (days since 1970)
  const yr = (d) => epochToYear(baseEpoch + d);
  const data = win.map((r) => ({
    month: r.bulletinMonth, hist: pdYear(r.priorityDate), fc: null, band80: null, band95: null, date: r.priorityDate,
  }));
  // seed the forecast line at the split so it connects to history
  data[data.length - 1].fc = data[data.length - 1].hist;
  data[data.length - 1].band80 = [data[data.length - 1].hist, data[data.length - 1].hist];
  data[data.length - 1].band95 = data[data.length - 1].band80;

  // 1) Real production-model forecast (pre-generated). 2) drift baseline fallback.
  const real = forecastFor(forecasts ?? null, country, category, table);
  let subtitle;
  let note;
  if (real && real.length) {
    for (const p of real)
      data.push({ month: p.date.slice(0, 7), hist: null, fc: yr(p.days), date: epochToDate(baseEpoch + p.days),
        band80: [yr(p.lo80), yr(p.hi80)], band95: [yr(p.lo95), yr(p.hi95)] });
    const meta = forecastMetaFor(forecasts ?? null, country, category, table);
    // Fallback label comes from the meta's method map (shipped with the forecasts),
    // never hardcoded — if the deployed champion changes, this follows automatically.
    const mlabel = meta?.models?.length
      ? meta.models.join("+")
      : (forecasts?.method?.[table] ?? (lang === "en" ? "production model" : "modelo de producción"));
    const mase = meta && Number.isFinite(meta.mase) ? (lang === "en" ? ` · hold-out MASE ${meta.mase}` : ` · MASE hold-out ${meta.mase}`) : "";
    subtitle = lang === "en"
      ? `Production-model forecast (${mlabel}) · 80 % / 95 % bands (conformal · per-horizon empirical quantiles)${mase}`
      : `Pronóstico del modelo de producción (${mlabel}) · bandas 80 % / 95 % (conformes · cuantiles empíricos por horizonte)${mase}`;
    // Prospective track record (real frozen forecasts vs realized cutoffs) — global.
    const sc = (forecasts ?? null)?.scorecard;
    if (sc) {
      // Guard each horizon: a missing by_horizon key must not render "±NaN d" (P2).
      const maeAt = (k) => { const v = sc.by_horizon[String(k)]?.mae_days; return Number.isFinite(v) ? Math.round(v) : null; };
      const hs = [3, 6, 12]
        .map((h) => [h, maeAt(h)])
        .filter(([, v]) => v != null)
        .map(([h, v]) => (lang === "en" ? `±${v} d at ${h} mo` : `±${v} d a ${h} m`));
      const cov = Number.isFinite(sc.overall?.cov95) ? Math.round(sc.overall.cov95 * 100) : null;
      const errClause = hs.length ? (lang === "en" ? `typical error ${hs.join(" · ")}. ` : `error típico ${hs.join(" · ")}. `) : "";
      const covClause = cov != null
        ? (lang === "en" ? `The 95 % band held in ${cov} % of cases overall (lower at the longest horizons).` : `La banda al 95 % acertó en el ${cov} % de los casos en conjunto (menor a los horizontes más largos).`)
        : "";
      if (errClause || covClause) {
        note = lang === "en"
          ? `Verified accuracy, global across all series (${sc.n_scored} forecasts scored vs already-published cutoffs; a leakage-free backfill): ${errClause}${covClause}`
          : `Precisión verificada, global de todas las series (${sc.n_scored} pronósticos evaluados vs cortes ya publicados; backfill sin fuga de información): ${errClause}${covClause}`;
      }
    }
  } else {
    // fit.last === the window's final daysSinceBase (the old `anchorDays`).
    const fit = fitDrift(win.map((r) => r.daysSinceBase));
    let m = last.bulletinMonth;
    for (let h = 1; h <= horizon; h++) {
      m = nextMonth(m);
      const b = driftBands(fit, h);
      data.push({ month: m, hist: null, fc: yr(b.point), date: epochToDate(baseEpoch + b.point),
        band80: [yr(b.lo80), yr(b.hi80)],
        band95: [yr(b.lo95), yr(b.hi95)] });
    }
    const perYear = fit.slope * 12;
    const dir = lang === "en" ? (perYear >= 0 ? "advancing" : "retrogressing") : (perYear >= 0 ? "avanzando" : "retrocediendo");
    subtitle = lang === "en"
      ? `Illustrative ${horizon}-month projection (in-browser drift baseline, ${dir} ~${Math.abs(Math.round(perYear))} days/yr) with 80 % / 95 % bands`
      : `Proyección ilustrativa a ${horizon} meses (línea base de deriva en el navegador, ${dir} ~${Math.abs(Math.round(perYear))} días/año) con bandas al 80 % / 95 %`;
  }
  return {
    kind: "forecast", splitMonth: last.bulletinMonth, note, fallback: !(real && real.length),
    // Explicit fail-closed signal (I2): the store loaded with an error state, so
    // the drift chart may render (labelled illustrative) but the LLM grounding
    // note must not present forecast figures as the production model's.
    productionUnavailable: forecasts?.status === "production_unavailable" || undefined,
    title: chartTitle("forecast", { country, category, table }, lang),
    subtitle,
    yLabel: lang === "en" ? "Priority year" : "Año de prioridad",
    data,
  };
}

// Grounding text so the LLM references the rendered forecast instead of denying
// it can show charts. Carries the real numbers it can quote.
export function forecastText(spec, lang) {
  const lastHist = [...spec.data].filter((d) => d.hist != null).pop();
  // I2 fail-closed: the production forecast store did not load. Do NOT fabricate
  // forecast context for the LLM — declare the outage (the UI may still show the
  // drift chart, which is labelled "illustrative" on its own subtitle) and give
  // only real panel facts (title + last published cutoff). Fixed template: it
  // must keep matching its NOTE_SKELETON in netlify/functions/chat.mjs.
  if (spec.productionUnavailable) {
    return lang === "en"
      ? `A FORECAST CHART could not be grounded: the production forecast feed is unavailable right now. ${spec.title}. Last real cutoff: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). The interface may show an in-browser drift projection clearly labelled as illustrative, but do NOT present its figures as the system's forecast and do NOT give any projected date or estimate. Tell the user the production forecast is temporarily unavailable and refer them to the official Visa Bulletin (travel.state.gov).`
      : `No fue posible anclar el GRÁFICO DE PRONÓSTICO: el pronóstico del modelo de producción no está disponible en este momento. ${spec.title}. Último corte real: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). La interfaz puede mostrar una proyección de deriva en el navegador claramente etiquetada como ilustrativa, pero NO presentes sus cifras como el pronóstico del sistema y NO des ninguna fecha proyectada ni estimación. Indica al usuario que el pronóstico de producción no está disponible temporalmente y remítelo al boletín oficial (travel.state.gov).`;
  }
  const end = spec.data[spec.data.length - 1];
  const b95 = bandOf(end.band95);
  const fmt = (yr) => (yr).toFixed(1);
  const h = spec.data.length - spec.data.findIndex((d) => d.month === spec.splitMonth) - 1;
  // spec.subtitle already states whether this is the PRODUCTION model or the in-browser
  // drift baseline; spec.note carries the verified out-of-sample track record (leakage-free backfill) when available.
  // Pass both through verbatim (do NOT re-label the production model as "illustrative").
  // I2: beyond the h validated months the note orders ABSTENTION — last validated
  // band + official bulletin — never a pace-extrapolated guess (the old wording
  // that ordered such an estimate is dead and rejected by the server skeletons).
  const acc = spec.note ? ` ${spec.note}` : "";
  return lang === "en"
    ? `A FORECAST CHART is being shown to the user right now — describe and interpret it; do NOT say you cannot show charts, and do NOT refuse. ${spec.title}. ${spec.subtitle}. Last real cutoff: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Projection at the ${h}-month horizon (${end.month}): about ${end.date} (priority year ≈ ${fmt(end.fc)}), 95% band [${fmt(b95[0])}, ${fmt(b95[1])}].${acc} If the user gave a priority date, say whether this projected cutoff reaches it within the ${h}-month horizon. If reaching it lies BEYOND the ${h} months shown, say so frankly, give the ${h}-month projection above (with its 95% band) as the furthest validated reading, refer the user to the official Visa Bulletin (travel.state.gov) for anything past the horizon, and do NOT give any date or estimate beyond the validated horizon. Frame it as an aggregate statistical forecast, not legal advice.`
    : `Se está mostrando al usuario un GRÁFICO DE PRONÓSTICO en este momento — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos y NO te niegues. ${spec.title}. ${spec.subtitle}. Último corte real: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Proyección al horizonte de ${h} meses (${end.month}): alrededor de ${end.date} (año de prioridad ≈ ${fmt(end.fc)}), banda al 95 % [${fmt(b95[0])}, ${fmt(b95[1])}].${acc} Si el usuario dio su fecha de prioridad, di si el corte proyectado la alcanza dentro del horizonte de ${h} meses. Si alcanzarla queda MÁS ALLÁ de los ${h} meses mostrados, dilo con franqueza, ofrece como última lectura validada la proyección al mes ${h} de arriba (con su banda al 95 %), remite al usuario al boletín oficial (travel.state.gov) para lo que quede más allá del horizonte y NO des ninguna fecha ni estimación más allá del horizonte validado. Enmárcalo como pronóstico estadístico agregado, no asesoría legal.`;
}

// ── monthly bulletin table (full panel history, any month) ──────────────────
export const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const monthLabel = (m, lang) => { const [y, mo] = m.split("-").map(Number); return `${(lang === "en" ? MONTHS_EN : MONTHS_ES)[mo - 1]} ${y}`; };

const catOrderSort = (cats) =>
  cats.sort((a, b) => { const ia = CAT_ORDER_FULL.indexOf(a), ib = CAT_ORDER_FULL.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });

// Beautiful monthly snapshot: categories × pilot countries for one table (FAD/DFF).
export function buildMonthTable(panel, month, tableType, lang) {
  const rows = panel.rows.filter((r) => r.bulletinMonth === month && r.table === tableType);
  if (!rows.length) return null;
  const countries = PILOT.filter((c) => rows.some((r) => r.country === c));
  const present = catOrderSort([...new Set(rows.map((r) => r.category))]);
  const cell = (cat, country) => { const r = rows.find((x) => x.category === cat && x.country === country); return { status: r?.status ?? "", date: r?.priorityDate ?? null }; };
  const mk = (cats) => cats.map((cat) => ({ cat, cells: countries.map((c) => cell(cat, c)) }));
  const fam = present.filter((c) => /^F/.test(c)), emp = present.filter((c) => /^EB/.test(c));
  const sections = [];
  if (fam.length) sections.push({ block: lang === "en" ? "Family-sponsored" : "Familiar", rows: mk(fam) });
  if (emp.length) sections.push({ block: lang === "en" ? "Employment-based" : "Empleo", rows: mk(emp) });
  return {
    kind: "table", month, tableType, countries,
    title: lang === "en" ? `Visa Bulletin · ${monthLabel(month, lang)} · ${tableType}` : `Visa Bulletin · ${monthLabel(month, lang)} · ${tableType}`,
    subtitle: lang === "en"
      ? "Priority-date cutoff per category × country. C = current, U = unavailable."
      : "Fecha de corte por categoría × país. C = al corriente (current), U = no disponible.",
    sections,
  };
}

// Compact real-data summary of a month table → grounding source so the LLM can
// answer any cell and never looks "limited to recent years".
export function monthTableText(spec, lang) {
  const head = spec.countries.map((c) => countryLabel(c)).join(" / ");
  const lines = spec.sections.flatMap((s) => s.rows.map((r) =>
    `${r.cat}: ${r.cells.map((c, i) => `${countryLabel(spec.countries[i])} ${c.status === "C" ? "C" : c.status === "U" ? "U" : c.date || "—"}`).join("; ")}`));
  return (lang === "en"
    ? `U.S. Visa Bulletin ${monthLabel(spec.month, lang)}, ${spec.tableType} (columns: ${head}). C = current, U = unavailable, otherwise the priority-date cutoff:\n`
    : `Visa Bulletin de EE. UU. ${monthLabel(spec.month, lang)}, ${spec.tableType} (columnas: ${head}). C = al corriente, U = no disponible, en otro caso la fecha de corte:\n`) + lines.join("\n");
}

// ── compare two bulletins (the "what changed between month A and month B" view) ─
// Diff every category × pilot country between two bulletins of the same table.
export function buildBulletinDiff(panel, monthA, monthB, tableType, lang) {
  if (monthA === monthB) return null;
  const [mA, mB] = monthA < monthB ? [monthA, monthB] : [monthB, monthA]; // A earlier, B later
  const rowsA = panel.rows.filter((r) => r.bulletinMonth === mA && r.table === tableType);
  const rowsB = panel.rows.filter((r) => r.bulletinMonth === mB && r.table === tableType);
  if (!rowsA.length && !rowsB.length) return null;
  const countries = PILOT.filter((c) => rowsA.some((r) => r.country === c) || rowsB.some((r) => r.country === c));
  if (!countries.length) return null;
  const cats = catOrderSort([...new Set([...rowsA, ...rowsB].map((r) => r.category))]);

  const findRow = (rows, cat, country) => rows.find((r) => r.category === cat && r.country === country) || null;
  let advanced = 0, retrogressed = 0, toCurrent = 0, toUnavailable = 0, unchanged = 0, other = 0;
  let topAdvance = null;
  let topRetro = null;

  const classify = (cat, country) => {
    const a = findRow(rowsA, cat, country), b = findRow(rowsB, cat, country);
    const base = { fromDate: a?.priorityDate ?? null, toDate: b?.priorityDate ?? null, fromStatus: a?.status ?? "", toStatus: b?.status ?? "", days: null };
    if (!a && !b) return { ...base, kind: "na" };
    if (!a && b) { other++; return { ...base, kind: "appeared" }; }
    if (a && !b) { other++; return { ...base, kind: "disappeared" }; }
    if (base.toStatus === "C") { if (base.fromStatus === "C") { unchanged++; return { ...base, kind: "flat" }; } toCurrent++; return { ...base, kind: "toCurrent" }; }
    if (base.toStatus === "U") { if (base.fromStatus === "U") { unchanged++; return { ...base, kind: "flat" }; } toUnavailable++; return { ...base, kind: "toUnavailable" }; }
    if (base.fromStatus === "C") { other++; return { ...base, kind: "fromCurrent" }; } // Current → a date = retrogression
    if (base.fromStatus === "U") { other++; return { ...base, kind: "fromUnavailable" }; } // Unavailable → a date = opened up
    const dd = (a.daysSinceBase != null && b.daysSinceBase != null)
      ? b.daysSinceBase - a.daysSinceBase
      : (base.fromDate && base.toDate ? isoDays(base.toDate) - isoDays(base.fromDate) : null);
    if (dd == null) { unchanged++; return { ...base, kind: "flat" }; }
    if (dd > 0) { advanced++; if (!topAdvance || dd > topAdvance.days) topAdvance = { cat, country, days: dd }; return { ...base, kind: "advance", days: dd }; }
    if (dd < 0) { retrogressed++; if (!topRetro || dd < topRetro.days) topRetro = { cat, country, days: dd }; return { ...base, kind: "retro", days: dd }; }
    unchanged++; return { ...base, kind: "flat", days: 0 };
  };

  const mk = (cs) => cs.map((cat) => ({ cat, cells: countries.map((c) => classify(cat, c)) }));
  const fam = cats.filter((c) => /^F/.test(c)), emp = cats.filter((c) => /^EB/.test(c));
  const sections = [];
  if (fam.length) sections.push({ block: lang === "en" ? "Family-sponsored" : "Familiar", rows: mk(fam) });
  if (emp.length) sections.push({ block: lang === "en" ? "Employment-based" : "Empleo", rows: mk(emp) });

  return {
    kind: "bulletinDiff", monthA: mA, monthB: mB, tableType, countries,
    title: lang === "en" ? `Bulletin comparison · ${monthLabel(mA, lang)} → ${monthLabel(mB, lang)} · ${tableType}` : `Comparación de boletines · ${monthLabel(mA, lang)} → ${monthLabel(mB, lang)} · ${tableType}`,
    subtitle: lang === "en"
      ? "How each category × country moved between the two bulletins (▲ advance, ▼ retrogression, →C became current, →U became unavailable)"
      : "Cómo se movió cada categoría × país entre los dos boletines (▲ avance, ▼ retroceso, →C pasó a current, →U pasó a no disponible)",
    summary: { advanced, retrogressed, toCurrent, toUnavailable, unchanged, other, topAdvance, topRetro },
    sections,
  };
}

// Grounding text so the LLM can answer any cell of the comparison it renders.
export function bulletinDiffText(spec, lang) {
  const s = spec.summary;
  const head = spec.countries.map((c) => countryLabel(c, lang)).join(" / ");
  const cellLabel = (cell, i) => {
    const cn = countryLabel(spec.countries[i], lang);
    const st = (status, date) => (status === "C" ? "C" : status === "U" ? "U" : date || "—");
    const delta = cell.kind === "advance" ? ` (+${cell.days}d)` : cell.kind === "retro" ? ` (${cell.days}d)` : "";
    return `${cn} ${st(cell.fromStatus, cell.fromDate)}→${st(cell.toStatus, cell.toDate)}${delta}`;
  };
  const lines = spec.sections.flatMap((sec) => sec.rows.map((r) => `${r.cat}: ${r.cells.map((c, i) => cellLabel(c, i)).join("; ")}`));
  const top = [];
  if (s.topAdvance) top.push(lang === "en" ? `biggest advance ${s.topAdvance.cat}/${countryLabel(s.topAdvance.country, lang)} +${s.topAdvance.days} d` : `mayor avance ${s.topAdvance.cat}/${countryLabel(s.topAdvance.country, lang)} +${s.topAdvance.days} d`);
  if (s.topRetro) top.push(lang === "en" ? `biggest retrogression ${s.topRetro.cat}/${countryLabel(s.topRetro.country, lang)} ${s.topRetro.days} d` : `mayor retroceso ${s.topRetro.cat}/${countryLabel(s.topRetro.country, lang)} ${s.topRetro.days} d`);
  const header = lang === "en"
    ? `A BULLETIN COMPARISON chart is shown to the user right now — describe and interpret it, do NOT refuse. ${monthLabel(spec.monthA, lang)} → ${monthLabel(spec.monthB, lang)}, ${spec.tableType} (columns: ${head}). Summary: ${s.advanced} advanced, ${s.retrogressed} retrogressed, ${s.toCurrent} became Current, ${s.toUnavailable} became Unavailable, ${s.unchanged} unchanged.${top.length ? " " + top.join("; ") + "." : ""} These are official published cutoffs, not predictions. Per cell (from→to; C=current, U=unavailable):\n`
    : `Se está mostrando al usuario una COMPARACIÓN DE BOLETINES — descríbela e interprétala, NO te niegues. ${monthLabel(spec.monthA, lang)} → ${monthLabel(spec.monthB, lang)}, ${spec.tableType} (columnas: ${head}). Resumen: ${s.advanced} avanzaron, ${s.retrogressed} retrocedieron, ${s.toCurrent} pasaron a Current, ${s.toUnavailable} a No disponible, ${s.unchanged} sin cambio.${top.length ? " " + top.join("; ") + "." : ""} Son cortes oficiales publicados, no predicciones. Por celda (de→a; C=al corriente, U=no disponible):\n`;
  return header + lines.join("\n");
}
