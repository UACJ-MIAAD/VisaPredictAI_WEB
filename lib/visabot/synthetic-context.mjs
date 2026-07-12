// US I1 (PENDIENTES #30) — server-side recompute of the VisaBot synthetic
// context. The browser no longer sends free-text "synthetic sources" (month
// tables / bulletin diffs / forecast notes) to the Claude proxy: it sends tiny
// STRUCTURED DESCRIPTORS ({kind, country, category, table, monthA…, release_id})
// and THIS module rebuilds the exact text server-side from verified release
// data. A client with valid-looking prose but invented figures ("F1: México
// 01JAN2099") is impossible by construction: the server never reads a single
// figure from the client — only identifiers, which it validates against the
// panel it fetched and hash-verified itself.
//
// Trust chain (documented for the audit):
//   1. The data repo publishes a release manifest (sha256/size per artifact);
//      scripts/fetch-data.mjs verifies + contract-validates + transactionally
//      swaps the artifacts into public/data at BUILD time (lib/release.mjs).
//   2. scripts/build-stats.mjs (same build) hashes the artifacts that landed in
//      public/data into lib/content/data-pins.generated.mjs, together with the
//      release_id served (from release-state.json). Those pins are BUNDLED into
//      the Netlify function — they are the function's root of trust.
//   3. At runtime the function fetches the artifacts from its own CDN
//      (/data/*) and re-verifies sha256+size against the bundled pins before
//      parsing. The base URL therefore only affects AVAILABILITY, never
//      integrity: bytes that do not hash to the build's pins are rejected.
//   4. The rebuilt text is finally validated against the same template grammar
//      (TABLE_HEADERS/ROW_RX/NOTE_SKELETONS in chat.mjs) as defense-in-depth
//      against a builder regression — fail-closed.
//
// Plain ESM (repo convention) so the Netlify function bundles it; the parsed
// panel+forecast store are cached in instance memory with a TTL.

import { createHash } from "node:crypto";
import { DATA_PINS } from "../content/data-pins.generated.mjs";
import { buildPanel, PANEL_CSV_URL } from "../data/panel-core.mjs";
import { parseForecastStore, unavailableStore, FORECAST_PATHS } from "../data/forecasts-core.mjs";
import {
  buildMonthTable, monthTableText, buildBulletinDiff, bulletinDiffText,
  buildForecast, forecastText, chartTitle, genericChartNote,
} from "./synthetic-builders.mjs";

export const MAX_SYNTH = 2;
// Same cap the proxy applies per context chunk (MAX_CHUNK in chat.mjs). An
// oversized rebuilt text is DROPPED, not erred — mirrors the old behavior where
// an oversized client synthetic was silently discarded by sanitizeContext.
const MAX_SYNTH_TEXT = 4000;

// Typed error codes (relayed as SSE {t:"error",code} with an HTTP status by chat.mjs).
export const SYNTH_ERR = {
  descriptorRequired: "synthetic_descriptor_required", // old client sent free-text synthetics
  releaseStale: "release_stale", // descriptor pinned to a release this function does not serve
  unknownSeries: "unknown_series", // country/category/table not in the verified panel
  unknownMonth: "unknown_month", // month(s) not in the verified panel
  unavailable: "synthetic_unavailable", // verified data could not be fetched right now
  rebuildFailed: "synthetic_rebuild_failed", // server-rebuilt text failed its own template grammar
};

// Server-owned source labels (mirror the fixed labels the console shows; the
// client's source/title strings are NEVER interpolated into the prompt).
export const SYNTH_SOURCES = {
  panel: { es: "Panel VisaPredict AI", en: "VisaPredict AI panel" },
  live: { es: "Gráfico en vivo (panel de datos real)", en: "Live chart (real data panel)" },
};

// ── descriptor validation (shape only — existence is checked against the
// verified panel in buildSyntheticContext) ──────────────────────────────────
const MONTH_RX = /^\d{4}-\d{2}$/;
const CODE_RX = /^[a-z0-9_]{1,32}$/i; // panel identifiers (country/category/table codes)
const KINDS = new Set(["month_table", "bulletin_diff", "forecast_note", "chart_note"]);
// Which params each generic chart kind REQUIRES for its title (a missing one
// would render "undefined" into the prompt — reject instead).
const CHART_PARAMS = {
  line: ["country", "category", "table"],
  movement: ["country", "category", "table"],
  compare: ["category", "table"],
  multiline: ["category", "table"],
  heatmap: ["block", "table"],
  radar: ["table"],
  status: [],
};
const BLOCKS = new Set(["empleo", "familia"]);

const code = (v) => (typeof v === "string" && CODE_RX.test(v) ? v : null);
const month = (v) => (typeof v === "string" && MONTH_RX.test(v) ? v : null);

// raw → { descriptors } | { error }. Only whitelisted fields survive: the
// descriptor is the ONLY thing the client controls and none of it is prose.
export function validateDescriptors(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SYNTH) return { error: "bad_request" };
  const descriptors = [];
  for (const d of raw) {
    if (!d || typeof d !== "object" || !KINDS.has(d.kind)) return { error: "bad_request" };
    if (typeof d.release_id !== "string" || !d.release_id || d.release_id.length > 80) return { error: "bad_request" };
    if (d.release_id !== DATA_PINS.releaseId) return { error: SYNTH_ERR.releaseStale };
    if (d.kind === "month_table") {
      const m = month(d.month), t = code(d.table);
      if (!m || !t) return { error: "bad_request" };
      descriptors.push({ kind: d.kind, month: m, table: t });
    } else if (d.kind === "bulletin_diff") {
      const a = month(d.monthA), b = month(d.monthB), t = code(d.table);
      if (!a || !b || !t) return { error: "bad_request" };
      descriptors.push({ kind: d.kind, monthA: a, monthB: b, table: t });
    } else if (d.kind === "forecast_note") {
      const c = code(d.country), cat = code(d.category), t = code(d.table);
      if (!c || !cat || !t) return { error: "bad_request" };
      // horizon is accepted for forward-compat but NEVER trusted: the server
      // derives the horizon from its own verified forecast artifacts.
      if (d.horizon !== undefined && !(Number.isInteger(d.horizon) && d.horizon > 0 && d.horizon <= 120)) return { error: "bad_request" };
      descriptors.push({ kind: d.kind, country: c, category: cat, table: t });
    } else {
      const params = CHART_PARAMS[d.chart];
      if (!params) return { error: "bad_request" };
      const out = { kind: d.kind, chart: d.chart };
      for (const f of ["country", "category", "table"]) {
        if (d[f] !== undefined) { const v = code(d[f]); if (!v) return { error: "bad_request" }; out[f] = v; }
      }
      if (d.block !== undefined) { if (!BLOCKS.has(d.block)) return { error: "bad_request" }; out.block = d.block; }
      for (const f of params) if (out[f] === undefined) return { error: "bad_request" };
      descriptors.push(out);
    }
  }
  return { descriptors };
}

// ── verified data loading (fetch own CDN → sha256 pin check → parse → cache) ─
const TTL_MS = 10 * 60 * 1000;
let _cache = null; // { base, at, promise }

export function resetSyntheticData() { _cache = null; }

async function fetchVerified(base, path, pinName, fetchImpl) {
  const pin = DATA_PINS.files[pinName];
  if (!pin) throw new Error(`no build-time pin for ${pinName}`);
  const r = await fetchImpl(base + path);
  if (!r.ok) throw new Error(`${pinName} HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length !== pin.size) throw new Error(`${pinName} size ${buf.length} != pinned ${pin.size}`);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== pin.sha256) throw new Error(`${pinName} sha256 mismatch vs bundled pin`);
  return buf.toString("utf8");
}

// Resolves { panel, store }. The panel is REQUIRED (every synthetic derives
// from it); the forecast artifacts degrade EXACTLY like the browser loader
// (lib/data/forecasts.ts): csv failure ⇒ explicit production_unavailable store
// (the forecast note then declares the outage, I2 fail-closed), meta ⇒ {},
// scorecard ⇒ null (accuracy clause omitted).
export function loadSyntheticData({ base, fetchImpl = fetch, now = Date.now } = {}) {
  const t = now();
  if (_cache && _cache.base === base && t - _cache.at < TTL_MS) return _cache.promise;
  const promise = (async () => {
    const panel = buildPanel(await fetchVerified(base, PANEL_CSV_URL, "visa_panel_long.csv", fetchImpl));
    let store;
    try {
      const csv = await fetchVerified(base, FORECAST_PATHS.csv, "forecasts.csv", fetchImpl);
      let meta = {};
      try { meta = JSON.parse(await fetchVerified(base, FORECAST_PATHS.meta, "forecasts_meta.json", fetchImpl)); } catch { meta = {}; }
      let scorecard = null;
      try { scorecard = JSON.parse(await fetchVerified(base, FORECAST_PATHS.scorecard, "forecast_scorecard.json", fetchImpl)); } catch { scorecard = null; }
      store = parseForecastStore(csv, meta, scorecard);
    } catch (e) {
      store = unavailableStore(e instanceof Error ? e.message : String(e));
    }
    return { panel, store };
  })();
  _cache = { base, at: t, promise };
  promise.catch(() => { if (_cache && _cache.promise === promise) _cache = null; }); // never cache a failed load
  return promise;
}

// ── reconstruction (the ONLY producer of synthetic prompt text) ─────────────
// descriptors are validateDescriptors output; data is loadSyntheticData output.
// Returns { sources } (n/title/source/text, all server-generated) or { error }.
export function buildSyntheticContext(descriptors, { panel, store }, lang) {
  const sources = [];
  for (const d of descriptors) {
    let title, source, text;
    if (d.kind === "month_table") {
      const spec = buildMonthTable(panel, d.month, d.table, lang);
      if (!spec) return { error: SYNTH_ERR.unknownMonth };
      title = spec.title; source = SYNTH_SOURCES.panel[lang]; text = monthTableText(spec, lang);
    } else if (d.kind === "bulletin_diff") {
      const spec = buildBulletinDiff(panel, d.monthA, d.monthB, d.table, lang);
      if (!spec) return { error: SYNTH_ERR.unknownMonth };
      title = spec.title; source = SYNTH_SOURCES.panel[lang]; text = bulletinDiffText(spec, lang);
    } else if (d.kind === "forecast_note") {
      if (!panel.countries.includes(d.country) || !panel.categories.includes(d.category) || !panel.tables.includes(d.table))
        return { error: SYNTH_ERR.unknownSeries };
      // EXACT mirror of the console call (assistant-console.tsx chartForQuery):
      // horizon from the server's own store, window 48, drift fallback inside.
      const spec = buildForecast(panel, d.country, d.category, d.table, lang, store.horizonMonths || undefined, 48, store);
      if (!spec) return { error: SYNTH_ERR.unknownSeries }; // < 8 F observations — the client can't chart it either
      title = spec.title; source = SYNTH_SOURCES.live[lang]; text = forecastText(spec, lang);
    } else {
      if (d.country && !panel.countries.includes(d.country)) return { error: SYNTH_ERR.unknownSeries };
      if (d.category && !panel.categories.includes(d.category)) return { error: SYNTH_ERR.unknownSeries };
      if (d.table && !panel.tables.includes(d.table)) return { error: SYNTH_ERR.unknownSeries };
      const t = chartTitle(d.chart, d, lang);
      if (!t) return { error: "bad_request" };
      title = t; source = SYNTH_SOURCES.live[lang]; text = genericChartNote(t, lang);
    }
    if (text.length > MAX_SYNTH_TEXT) continue; // dropped, not erred (see MAX_SYNTH_TEXT)
    sources.push({ n: sources.length + 1, title, source, text });
  }
  return { sources };
}
