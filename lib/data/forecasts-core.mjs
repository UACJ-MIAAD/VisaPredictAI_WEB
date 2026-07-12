// US I1 — pure forecast-store parsing, shared by the browser loader
// (lib/data/forecasts.ts) and the Netlify chat function (server-side
// synthetic-context recompute, PENDIENTES #30). Plain ESM on purpose (same
// convention as panel-core.mjs / retrieval-core.mjs): the function bundles
// under plain Node. Types live in forecasts-core.d.mts.
//
// The parsing semantics are EXACTLY the old loadForecasts body: same CSV
// column resolution, same meta key normalization ("/" → "|"), same horizon
// derivation (explicit positive meta field wins, else max point count), same
// scorecard gate (n_scored > 0). Any change here changes BOTH sides at once —
// that is the point (single source, no server/client divergence).

const key = (country, category, table) => `${country}|${category}|${table}`;

// Served-artifact paths (same-origin /data/*): single source for the client
// fetches and the server-side verified fetches.
export const FORECAST_PATHS = {
  csv: "/data/forecasts.csv",
  meta: "/data/forecasts_meta.json",
  scorecard: "/data/forecast_scorecard.json",
};

// Explicit fail-closed store (I2): consumers must be able to tell "no forecast
// for this series" from "the whole production feed failed to load".
export function unavailableStore(reason) {
  return { method: {}, series: new Map(), meta: new Map(), scorecard: null, horizonMonths: 0, status: "production_unavailable", reason };
}

// csv: text of forecasts.csv · metaJson: parsed forecasts_meta.json (or {}) ·
// scorecardJson: parsed forecast_scorecard.json (or null). Returns a healthy
// ("ok") store; callers map fetch failures to unavailableStore themselves.
export function parseForecastStore(csv, metaJson, scorecardJson) {
  const meta = metaJson ?? {};
  const scorecard = scorecardJson && scorecardJson.n_scored > 0 ? scorecardJson : null;
  const store = { method: meta.method ?? {}, series: new Map(), meta: new Map(), scorecard, horizonMonths: 0, status: "ok" };
  const lines = (typeof csv === "string" ? csv : "").split("\n");
  const h = (lines[0] ?? "").split(",");
  const ix = (k) => h.indexOf(k);
  const I = { c: ix("country"), cat: ix("category"), t: ix("table"), d: ix("date"), days: ix("days"), lo80: ix("lo80"), hi80: ix("hi80"), lo95: ix("lo95"), hi95: ix("hi95") };
  // Fail-closed (I2, auditoría 12-jul-2026): un header sin las columnas requeridas NO es
  // un CSV de forecasts válido → production_unavailable, no un store "ok" vacío que
  // degrada en silencio a la deriva ilustrativa.
  if ([I.c, I.cat, I.t, I.d, I.days, I.lo80, I.hi80, I.lo95, I.hi95].some((j) => j < 0))
    return unavailableStore("malformed_forecast_header");
  // Incompatible meta (I2, auditoría 12-jul): meta.series debe ser objeto si viene;
  // horizon_months, si viene, debe ser un número no negativo.
  if (meta.series != null && typeof meta.series !== "object") return unavailableStore("malformed_forecast_meta");
  if (meta.horizon_months != null && !(typeof meta.horizon_months === "number" && meta.horizon_months >= 0))
    return unavailableStore("malformed_forecast_meta");
  // Validación ESTRICTA de fecha calendario: exacto YYYY-MM-DD (sin basura al final) Y
  // fecha real ("2026-99-99garbage" ya no cuela — el regex de prefijo lo aceptaba).
  const isRealDate = (s) => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  // Parse a numeric cell ONLY if it is a non-empty finite number string. `+""` and
  // `+" "` coerce to 0 — an empty band/days field must NOT silently become zero.
  const num = (v) => {
    if (typeof v !== "string" || v.trim() === "") return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  let dataRows = 0;
  let droppedRows = 0;
  const seen = new Map(); // (series|date) -> serialized point, to catch contradictory dupes
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const a = lines[i].split(",");
    // A short/truncated row IS corruption — count it, don't silently skip (a flood of
    // truncated rows must be able to fail the feed closed, not hide behind one valid row).
    if (a.length < 9 || !a[I.c]) { dataRows++; droppedRows++; continue; }
    dataRows++;
    const days = num(a[I.days]), lo80 = num(a[I.lo80]), hi80 = num(a[I.hi80]), lo95 = num(a[I.lo95]), hi95 = num(a[I.hi95]);
    // reject a corrupt point: empty/non-finite number, non-calendar date, incoherent bands,
    // or a point forecast outside its own 95% interval (structurally impossible).
    if ([days, lo80, hi80, lo95, hi95].some(Number.isNaN) || !isRealDate(a[I.d]) ||
        lo80 > hi80 || lo95 > hi95 || lo95 > lo80 || hi95 < hi80 ||
        days < lo95 || days > hi95) { droppedRows++; continue; }
    const k = key(a[I.c], a[I.cat], a[I.t]);
    // Contradictory duplicate: same (series, date) with DIFFERENT numbers → corrupt feed.
    const dk = `${k}|${a[I.d]}`;
    const ser = `${days},${lo80},${hi80},${lo95},${hi95}`;
    const prev = seen.get(dk);
    if (prev !== undefined) { if (prev !== ser) droppedRows++; continue; } // dup: identical=harmless, differing=drop
    seen.set(dk, ser);
    (store.series.get(k) ?? store.series.set(k, []).get(k)).push({ date: a[I.d], days, lo80, hi80, lo95, hi95 });
  }
  // An all-header feed serves zero forecasts — a production failure, not "ok empty".
  if (dataRows === 0) return unavailableStore("empty_forecast_feed");
  // If the feed had rows but none survived, or a MINORITY threshold of corruption is
  // exceeded, the artifact is broken — serve unavailable instead of a hollow "ok".
  if (store.series.size === 0 || droppedRows > dataRows / 2)
    return unavailableStore("corrupt_forecast_rows");
  if (meta.series) for (const [k, v] of Object.entries(meta.series)) store.meta.set(k.replace(/\//g, "|"), v);
  // horizon derived from the pipeline: prefer the explicit meta field (only if
  // positive — an explicit 0 must not survive), else the real point count per series
  let maxLen = 0;
  for (const a of store.series.values()) if (a.length > maxLen) maxLen = a.length;
  store.horizonMonths = (typeof meta.horizon_months === "number" && meta.horizon_months > 0) ? meta.horizon_months : maxLen;
  return store;
}

export const forecastFor = (store, country, category, table) =>
  store?.series.get(key(country, category, table)) ?? null;
export const forecastMetaFor = (store, country, category, table) =>
  store?.meta.get(key(country, category, table)) ?? null;
