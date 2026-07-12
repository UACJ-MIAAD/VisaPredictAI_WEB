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
  const lines = csv.split("\n");
  const h = lines[0].split(",");
  const ix = (k) => h.indexOf(k);
  const I = { c: ix("country"), cat: ix("category"), t: ix("table"), d: ix("date"), days: ix("days"), lo80: ix("lo80"), hi80: ix("hi80"), lo95: ix("lo95"), hi95: ix("hi95") };
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i].split(",");
    if (a.length < 9 || !a[I.c]) continue;
    const k = key(a[I.c], a[I.cat], a[I.t]);
    const pt = { date: a[I.d], days: +a[I.days], lo80: +a[I.lo80], hi80: +a[I.hi80], lo95: +a[I.lo95], hi95: +a[I.hi95] };
    (store.series.get(k) ?? store.series.set(k, []).get(k)).push(pt);
  }
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
