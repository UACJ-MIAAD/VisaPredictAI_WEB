// VisaBot golden set · shared library (US I3, plan auditoría 3 repos 12-jul-2026).
//
// Single source for: loading the golden set (dev + holdout halves), structural
// validation, the DETERMINISTIC holdout membership function, and fact-reference
// resolution against the REAL artifacts in public/data (regla #0: the eval set
// never hand-types a canonical figure — numeric facts are `ref`s resolved at
// eval time, so a re-derivation upstream can never leave a stale number here).
//
// Used by: scripts/rag-golden-eval.mjs (the gate), scripts/golden-holdout-split.mjs
// (the seeded 20% split) and scripts/check-eval-sets.mjs (PR-cheap validation).
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GOLDEN_DIR = join(ROOT, "evals", "golden");
export const HOLDOUT_DIR = join(GOLDEN_DIR, "holdout");

// Category files. The composition minimums are part of the contract: a PR that
// deletes questions below these floors fails check-eval-sets.
export const CATEGORY_FILES = ["factual.json", "forecast.json", "unanswerable.json", "multiturn.json", "poisoning.json"];
export const MIN_COUNTS = { factual: 60, forecast: 40, forecast_out: 20, unanswerable: 30, multiturn: 40, poisoning: 30, total: 200, perLang: 90 };

// ── deterministic holdout membership ────────────────────────────────────────
// sha256(SEED:id) → ~20% of ids land in holdout. Membership is a pure function
// of the stable question id, so editing a question's text never reshuffles the
// split and the split script is idempotent. NOTE the honesty caveat documented
// in evals/golden/holdout/README.md: the AUTHOR curated questions before
// splitting; independent-person curation of the holdout remains a human TODO.
export const HOLDOUT_SEED = "visapredict-golden-v1";
export function isHoldout(id) {
  const h = createHash("sha256").update(`${HOLDOUT_SEED}:${id}`).digest();
  return h.readUInt32BE(0) % 5 === 0; // ≈20%
}

// ── loading ──────────────────────────────────────────────────────────────────
// The CATEGORY_FILES under evals/golden/ are the COMPLETE authored set and the
// single source of truth (one place to edit/review). Membership in the holdout
// is a PURE FUNCTION of the stable id (isHoldout), so:
//   split "dev"     → cases where !isHoldout(id)   (what the gate evaluates)
//   split "holdout" → cases where  isHoldout(id)
//   split "all"     → everything (composition contract)
// evals/golden/holdout/ is a GENERATED view (golden-holdout-split.mjs) for the
// human curator; the loader never depends on it, so the two can never drift.
function readSet(path) {
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data.cases)) throw new Error(`${path}: falta "cases"`);
  return data.cases;
}

// split: "dev" | "holdout" | "all"
export function loadGoldenSet(split = "dev") {
  const cases = [];
  for (const f of CATEGORY_FILES) {
    for (const c of readSet(join(GOLDEN_DIR, f))) {
      const held = c.id ? isHoldout(c.id) : false;
      if (split === "all" || (split === "holdout") === held) cases.push({ ...c, _file: f, _split: held ? "holdout" : "dev" });
    }
  }
  return cases;
}

// ── structural validation ────────────────────────────────────────────────────
const CATEGORIES = new Set(["factual", "forecast_in", "forecast_out", "unanswerable", "multiturn", "poisoning"]);
const REASONS = new Set(["out_of_domain", "legal_advice", "beyond_horizon", "future_not_validated", "no_data"]);
const VECTORS = new Set(["query", "context", "synthetic", "stream"]);

export function validateGoldenSet(cases) {
  const problems = [];
  const seen = new Set();
  for (const c of cases) {
    const at = `${c._file || "?"}:${c.id || "?"}`;
    if (!c.id || typeof c.id !== "string") problems.push(`${at}: falta id`);
    else if (seen.has(c.id)) problems.push(`${at}: id duplicado`);
    else seen.add(c.id);
    if (c.lang !== "es" && c.lang !== "en") problems.push(`${at}: lang inválido`);
    if (!CATEGORIES.has(c.category)) problems.push(`${at}: category inválida (${c.category})`);
    const isMulti = c.category === "multiturn";
    const isPoison = c.category === "poisoning";
    if (isMulti) {
      if (!Array.isArray(c.turns) || c.turns.length < 2 || !c.turns.every((t) => typeof t === "string" && t.length > 3))
        problems.push(`${at}: multiturn requiere turns[≥2]`);
    } else if (isPoison) {
      if (!VECTORS.has(c.vector)) problems.push(`${at}: vector inválido (${c.vector})`);
      if (typeof c.attack !== "string" || c.attack.length < 8) problems.push(`${at}: poisoning requiere attack`);
      if (c.must_not) tryRegex(c.must_not, problems, at, "must_not");
    } else if (typeof c.question !== "string" || c.question.length < 8) {
      problems.push(`${at}: falta question`);
    }
    if (!isPoison && typeof c.answerable !== "boolean") problems.push(`${at}: falta answerable (bool)`);
    if (c.answerable === false && !REASONS.has(c.reason)) problems.push(`${at}: unanswerable requiere reason válido`);
    if (c.category === "forecast_out") {
      if (c.answerable !== false || c.reason !== "beyond_horizon") problems.push(`${at}: forecast_out debe ser answerable:false + reason:beyond_horizon`);
      if (!Number.isFinite(c.asks_months) || c.asks_months <= 0) problems.push(`${at}: forecast_out requiere asks_months`);
    }
    if (c.category === "forecast_in" && (!Number.isFinite(c.asks_months) || c.asks_months <= 0)) problems.push(`${at}: forecast_in requiere asks_months`);
    if (!isPoison && c.answerable && (typeof c.acceptable_answer !== "string" || c.acceptable_answer.length < 8))
      problems.push(`${at}: answerable requiere acceptable_answer`);
    for (const f of c.facts || []) {
      if (!f.ref && !f.pattern) problems.push(`${at}: fact sin ref ni pattern`);
      if (f.ref && !/^[a-z_]+:[A-Za-z0-9_.]+$/.test(f.ref)) problems.push(`${at}: ref malformado (${f.ref})`);
      if (f.pattern) {
        tryRegex(f.pattern, problems, at, "fact.pattern");
        // Regla #0: los hechos numéricos van por `ref` (derivados), nunca tipeados
        // en un pattern — un número decimal tipeado aquí sería una cifra canónica
        // fuera del alcance del guardián. Años (19xx/20xx) y códigos F4/EB5 sí pasan.
        if (/\d+[.,]\d+/.test(f.pattern)) problems.push(`${at}: pattern con número decimal tipeado (usa ref): ${f.pattern}`);
      }
    }
    if (c.must_not_in_context) tryRegex(c.must_not_in_context, problems, at, "must_not_in_context");
    for (const e of c.expected_sources || []) {
      const alts = Array.isArray(e) ? e : [e];
      if (!alts.length || !alts.every((a) => typeof a === "string" && a.length > 1)) problems.push(`${at}: expected_sources malformado`);
    }
  }
  return problems;
}

function tryRegex(src, problems, at, field) {
  try { new RegExp(src, "i"); } catch { problems.push(`${at}: ${field} regex inválida: ${src}`); }
}

export function composition(cases) {
  const by = (fn) => cases.reduce((m, c) => { const k = fn(c); m[k] = (m[k] || 0) + 1; return m; }, {});
  const cat = by((c) => c.category);
  return {
    total: cases.length,
    byCategory: cat,
    byLang: by((c) => c.lang),
    forecast: (cat.forecast_in || 0) + (cat.forecast_out || 0),
  };
}

export function checkComposition(cases) {
  const problems = [];
  const c = composition(cases);
  if (c.total < MIN_COUNTS.total) problems.push(`total ${c.total} < ${MIN_COUNTS.total}`);
  if ((c.byCategory.factual || 0) < MIN_COUNTS.factual) problems.push(`factual ${c.byCategory.factual || 0} < ${MIN_COUNTS.factual}`);
  if (c.forecast < MIN_COUNTS.forecast) problems.push(`forecast ${c.forecast} < ${MIN_COUNTS.forecast}`);
  if ((c.byCategory.forecast_out || 0) < MIN_COUNTS.forecast_out) problems.push(`forecast_out ${c.byCategory.forecast_out || 0} < ${MIN_COUNTS.forecast_out}`);
  if ((c.byCategory.unanswerable || 0) < MIN_COUNTS.unanswerable) problems.push(`unanswerable ${c.byCategory.unanswerable || 0} < ${MIN_COUNTS.unanswerable}`);
  if ((c.byCategory.multiturn || 0) < MIN_COUNTS.multiturn) problems.push(`multiturn ${c.byCategory.multiturn || 0} < ${MIN_COUNTS.multiturn}`);
  if ((c.byCategory.poisoning || 0) < MIN_COUNTS.poisoning) problems.push(`poisoning ${c.byCategory.poisoning || 0} < ${MIN_COUNTS.poisoning}`);
  if ((c.byLang.es || 0) < MIN_COUNTS.perLang || (c.byLang.en || 0) < MIN_COUNTS.perLang)
    problems.push(`balance ES/EN ${c.byLang.es || 0}/${c.byLang.en || 0} (mínimo ${MIN_COUNTS.perLang} c/u)`);
  return problems;
}

// ── fact resolution (refs → real artifacts) ─────────────────────────────────
// "eda_facts:panel.n_obs" → public/data/eda_facts.json → .panel.n_obs
// "site_stats:nModels"    → lib/content/site-stats.generated.mjs (build-derived)
const ARTIFACTS = {
  eda_facts: () => JSON.parse(readFileSync(join(ROOT, "public", "data", "eda_facts.json"), "utf8")),
  forecasts_meta: () => JSON.parse(readFileSync(join(ROOT, "public", "data", "forecasts_meta.json"), "utf8")),
  scorecard: () => JSON.parse(readFileSync(join(ROOT, "public", "data", "forecast_scorecard.json"), "utf8")),
};
let siteStatsCache = null;
async function siteStats() {
  if (!siteStatsCache) siteStatsCache = (await import(join(ROOT, "lib", "content", "site-stats.generated.mjs"))).SITE_STATS;
  return siteStatsCache;
}
const artifactCache = new Map();

export async function resolveRef(ref) {
  const [name, path] = ref.split(":");
  let root;
  if (name === "site_stats") root = await siteStats();
  else if (ARTIFACTS[name]) {
    if (!artifactCache.has(name)) artifactCache.set(name, ARTIFACTS[name]());
    root = artifactCache.get(name);
  } else throw new Error(`ref con artefacto desconocido: ${ref}`);
  let v = root;
  for (const k of path.split(".")) {
    if (v == null || !(k in v)) throw new Error(`ref no resuelve en el artefacto: ${ref} (se detuvo en "${k}")`);
    v = v[k];
  }
  if (typeof v === "object") throw new Error(`ref no apunta a un escalar: ${ref}`);
  return v;
}

// Textual representations a resolved value may take inside chunk prose, so the
// grounding check tolerates rounding and thousands separators. Matching runs on
// FOLDED text (lowercase, accents stripped) with a variant where separators
// inside numbers are removed.
export function factRepresentations(value, kind) {
  const reps = new Set();
  if (kind === "yearmonth" || (typeof value === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(value))) {
    const s = String(value);
    reps.add(s);
    reps.add(s.slice(0, 7));
    reps.add(s.slice(0, 4)); // year alone = weakest necessary condition (documented)
    return [...reps];
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      reps.add(String(value));
      if (Math.abs(value) >= 1000) reps.add(value.toLocaleString("en-US")); // 27,611
    } else {
      reps.add(String(value));
      for (const d of [3, 2, 1]) {
        const r = value.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
        if (r.length >= 3) reps.add(r); // never degrade to a bare "0." or 1-digit
      }
      // A rounded-integer form only when it is a meaningful token (|value| ≥ 1,
      // e.g. 2.42 → "2"). For sub-1 metrics (MASE 0.347) rounding gives "0",
      // which is a 1-char token that would match any "0" in prose — dropped.
      const ri = Math.round(value);
      if (Math.abs(ri) >= 1) reps.add(String(ri));
    }
    return [...reps];
  }
  reps.add(String(value));
  return [...reps];
}
