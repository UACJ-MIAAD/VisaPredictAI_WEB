// VisaBot · shared retrieval core (single source of truth).
//
// Retrieval used to be hand-copied in FOUR places — components/visabot/engine.ts
// and the three scripts/rag-*.mjs evals — and they drifted: two evals tokenized
// WITHOUT the contextual `embedCtx` prefix while production used it, so the
// "faithful replicas" no longer reflected shipped retrieval (audit findings 12,
// 23). This module is the ONE implementation imported by all four. Plain .mjs so
// both the TypeScript client bundle (`@/lib/visabot/retrieval-core.mjs`) and the
// Node eval scripts (`../lib/visabot/retrieval-core.mjs`) load the exact same
// code — mirroring the lib/repo.mjs single-source pattern.
//
// Tuning constants live here too, so a change to k1/b/RRF_K/POOL/λ can only
// happen in one place.

// ── tuning ──────────────────────────────────────────────────────────────────
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;
export const RRF_K = 60;
export const POOL = 40; // candidates kept per modality
export const MMR_LAMBDA = 0.7;

// ── float16 codec (US I6: vectors ship as raw f16, half the bytes) ──────────
// The build QUANTIZES the embeddings to f16 and then round-trips them back to
// f32 before writing index.json (the eval monolith), so the browser decoding
// vectors.f16 with decodeF16 and every eval decoding index.json's base64 f32
// score with BIT-IDENTICAL floats — no production/eval drift. Decode is manual
// bit math (no Float16Array/DataView.getFloat16 dependency: those need V8 13.4+,
// while Netlify/CI build on Node 22 and old browsers must still run BM25-only).
export function f16BitsToF32(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h & 0x7c00) >> 10;
  const frac = h & 0x03ff;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024); // subnormal / ±0
  if (exp === 0x1f) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

// Round an f32 to the nearest f16-representable value (round-half-to-even),
// returning that value as an f32. Standalone bit-independent math: Math.f16round
// is Node ≥24 only, so the Netlify/CI Node 22 build (which quantizes vectors in
// rag:build) and older browsers would throw on it — the codec must not depend on
// it. Packing the returned value below is then EXACT (it is f16-representable).
function _f16roundValue(x) {
  if (Number.isNaN(x)) return NaN;
  if (!Number.isFinite(x) || x === 0) return x; // ±Inf, ±0 pass through
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  if (a >= 2 ** 16) return sign * Infinity; // above f16 range → ±Inf
  const MIN_NORMAL = 2 ** -14;
  let step;
  if (a < MIN_NORMAL) {
    step = 2 ** -24; // subnormal granularity
  } else {
    step = 2 ** (Math.floor(Math.log2(a)) - 10); // 10 mantissa bits
  }
  const q = a / step;
  const fl = Math.floor(q);
  const frac = q - fl;
  let r = fl;
  if (frac > 0.5 || (frac === 0.5 && fl % 2 === 1)) r += 1; // round-half-to-even
  const out = sign * r * step;
  return Math.abs(out) > 65504 ? sign * Infinity : out; // rounded up past f16 max
}

// Encode one f32 as f16 bits: round to nearest f16, then pack (exact, since all
// shifted-out mantissa bits are zero by construction).
const _f16buf = new DataView(new ArrayBuffer(4));
export function f32ToF16Bits(x) {
  const r = _f16roundValue(x);
  _f16buf.setFloat32(0, r);
  const bits = _f16buf.getUint32(0);
  const sign = (bits >>> 16) & 0x8000;
  const exp32 = (bits >>> 23) & 0xff;
  const mant32 = bits & 0x7fffff;
  if (exp32 === 0xff) return sign | 0x7c00 | (mant32 ? 0x200 : 0); // Inf / NaN
  const e = exp32 - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00; // overflow → ±Inf
  if (e <= 0) {
    if (e < -10) return sign; // underflow → ±0
    return sign | ((mant32 | 0x800000) >> (24 - 10 - e)); // exact: r is f16-representable
  }
  return sign | (e << 10) | (mant32 >> 13);
}

export function encodeF16(f32) {
  const out = new Uint16Array(f32.length);
  for (let i = 0; i < f32.length; i++) out[i] = f32ToF16Bits(f32[i]);
  return out;
}

// bytes (Uint8Array/ArrayBuffer, little-endian uint16 stream) → Float32Array
export function decodeF16(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = u8.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f16BitsToF32(u8[2 * i] | (u8[2 * i + 1] << 8));
  return out;
}

// ── tokenization (accent-folded, stopword-trimmed, code-normalized) ──────────
export const STOP = new Set(
  ("de la el los las un una unos unas y o a en que es del al se su por con para " +
    "the a an of to in is are and or for on with that this it as by be from at " +
    "qué que como cómo cuál cuales donde dónde es son está están").split(" "),
);

export const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Fold the letter↔digit boundary in visa category codes so every spelling of a
// code collapses to one token: EB-5 / EB 5 / EB.5 / EB5 → "eb5", F2-A / F2 A /
// F2A → "f2a", F 4 → "f4". Without this, "EB-5" tokenized to ["eb"] (the lone
// digit dropped by the length>1 filter), so EB-2…EB-5 were lexically
// indistinguishable under BM25 and query/document spellings never matched
// (audit findings 2, 7). Runs on the already-folded (lowercase) string.
// The optional [ab] suffix must NOT be followed by another letter, or it eats
// the first letter of an adjacent word ("f1 backlog"→"f1backlog"), corrupting
// the BM25 token so query and document no longer match.
export const normalizeCodes = (s) =>
  s.replace(/\b(eb|f)[\s._-]?(\d)(?:[\s._-]?([ab])(?![a-z]))?/g, (_m, p, d, x) => p + d + (x || ""));

export const tokenize = (s) =>
  normalizeCodes(fold(s))
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

// The exact text a chunk contributes to the sparse (BM25) index: the structural
// `embedCtx` prefix (Contextual Retrieval, academic/docs only) + title + text.
// engine.ts and all evals MUST build BM25 from this identical string.
export const idxText = (c) => `${c.embedCtx ? c.embedCtx + " " : ""}${c.title} ${c.text}`;

// ── sparse index (BM25 Okapi) ───────────────────────────────────────────────
// Build per-document term frequencies + corpus IDF from the chunk list.
export function buildBM25(chunks) {
  const docTf = [];
  const docLen = [];
  const df = new Map();
  for (const c of chunks) {
    const toks = tokenize(idxText(c));
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docTf.push(tf);
    docLen.push(toks.length);
  }
  const N = chunks.length;
  const idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  const avgdl = docLen.reduce((a, b) => a + b, 0) / Math.max(1, N);
  return { docTf, docLen, idf, avgdl };
}

// Okapi BM25 scoring of `qTokens` over the candidate `pool` (chunk indices).
export function bm25Rank(L, qTokens, pool) {
  const scored = pool.map((i) => {
    let s = 0;
    for (const t of qTokens) {
      const f = L.docTf[i].get(t);
      if (!f) continue;
      const idf = L.idf.get(t) || 0;
      s += idf * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * L.docLen[i]) / L.avgdl)));
    }
    return { i, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, POOL);
}

// ── dense scoring (cosine over L2-normalized flat vectors) ──────────────────
export function denseRank(vectors, dim, qv, pool) {
  const scored = pool.map((i) => {
    let s = 0;
    const off = i * dim;
    for (let k = 0; k < dim; k++) s += qv[k] * vectors[off + k];
    return { i, s };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, POOL);
}

export function cosineIdx(vectors, dim, a, b) {
  let s = 0;
  for (let k = 0; k < dim; k++) s += vectors[a * dim + k] * vectors[b * dim + k];
  return s;
}

// ── fusion (Reciprocal Rank Fusion) ─────────────────────────────────────────
export function rrfFuse(lex, dense) {
  const rrf = new Map();
  lex.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (RRF_K + r)));
  dense.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (RRF_K + r)));
  return [...rrf.entries()].map(([i, s]) => ({ i, s })).sort((a, b) => b.s - a.s);
}

// ── diversification (Maximal Marginal Relevance) ────────────────────────────
// `useDiversity` mirrors engine.ts's `haveVecs`: only penalize redundancy when
// dense retrieval actually ran (pre-consent BM25-only keeps the fused order).
export function mmrSelect(vectors, dim, fused, k, useDiversity) {
  const selected = [];
  const cand = fused.slice(0, Math.max(k * 4, 16));
  if (!cand.length) return selected;
  const maxRel = cand[0].s || 1;
  while (selected.length < k && cand.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (let ci = 0; ci < cand.length; ci++) {
      const { i, s } = cand[ci];
      let div = 0;
      if (useDiversity && selected.length) div = Math.max(...selected.map((j) => cosineIdx(vectors, dim, i, j)));
      const score = MMR_LAMBDA * (s / maxRel) - (1 - MMR_LAMBDA) * div;
      if (score > bestScore) {
        bestScore = score;
        best = ci;
      }
    }
    selected.push(cand[best].i);
    cand.splice(best, 1);
  }
  return selected;
}

// ── query understanding + reranking (the "best RAG" layer) ──────────────────
// Domain acronyms. Query expansion is PHRASE→ACRONYM only (add the short, highly
// specific code when the spelled-out phrase is present): safe and precision-
// preserving. The reverse (acronym→common words like "mean"/"error") is
// deliberately NOT done — it would conflate sibling metrics under BM25.
const ACRONYMS = [
  ["fad", "final action dates"],
  ["dff", "dates for filing"],
  ["mase", "mean absolute scaled error"],
  ["smape", "symmetric mean absolute percentage error"],
  ["rmse", "root mean squared error"],
  ["mcs", "model confidence set"],
  ["crisp", "crisp dm"],
  ["ina", "immigration and nationality act"],
  ["lpr", "lawful permanent resident"],
];
// Pre-tokenize each phrase with the SAME tokenizer (drops stopwords like "for"),
// so "dates for filing" → ["dates","filing"] actually matches a tokenized query.
const ACRO_TOKENS = ACRONYMS.map(([acr, phrase]) => [acr, tokenize(phrase)]);
export function expandQuery(tokens) {
  const set = new Set(tokens);
  for (const [acr, ptoks] of ACRO_TOKENS) {
    if (ptoks.length && !set.has(acr) && ptoks.every((p) => set.has(p))) set.add(acr);
  }
  return [...set];
}

// Detect the query's language independent of the page locale so a cross-lingual
// query (English typed on the ES site, or vice versa) can broaden its pool.
// Only UNAMBIGUOUS Spanish markers — bare words like el/la/los/las/con/son/para
// also occur in English text and place names ("Los Angeles", "pros and cons"),
// which would misfire to "es" and needlessly broaden the pool on the EN site.
export const detectQueryLang = (q) =>
  /[¿¡áéíóúñ]/i.test(q) ||
  /\b(qu[eé]|c[oó]mo|cu[aá]l(?:es)?|cu[aá]ndo|d[oó]nde|por qu[eé]|cu[aá]nto|del|una)\b/i.test(q)
    ? "es"
    : "en";

// Light, model-free reranker over the fused top window: reward chunks whose
// TITLE matches query terms (a title hit is a strong relevance signal), reward
// glossary/fact chunks for definitional queries, and penalize off-locale chunks.
// Reorders within the window only, so it can lift the right answer without
// dropping a relevant chunk out of the MMR candidate set.
export function rerankFused(fused, chunks, rawQTokens, lang, query, variant = "v1") {
  if (fused.length <= 1) return fused;
  const qset = new Set(rawQTokens);
  const definitional = /\b(qu[eé]|what|significa|define|definic|meaning|mean by)\b/i.test(query);
  const N = Math.min(fused.length, 24);
  const head = fused
    .slice(0, N)
    .map(({ i, s }) => {
      const c = chunks[i];
      let titleHit = 0;
      for (const t of tokenize(c.title)) if (qset.has(t)) titleHit++;
      let bonus = 0.18 * titleHit;
      if (definitional && (c.kind === "glossary" || c.kind === "fact")) bonus += 0.2;
      if (c.lang !== lang) bonus -= 0.4;
      // I4 ablation variant "cover" (NOT the default — flip only if the ablation
      // gate wins; see docs/VISABOT_RAG_ROADMAP.md): reward query-term COVERAGE
      // over the chunk body, a cheap proxy for cross-encoder relevance.
      if (variant === "cover" && qset.size) {
        const ctoks = new Set(tokenize(idxText(c)));
        let cover = 0;
        for (const t of qset) if (ctoks.has(t)) cover++;
        bonus += 0.15 * (cover / qset.size);
      }
      return { i, s: s * (1 + bonus) };
    })
    .sort((a, b) => b.s - a.s);
  return [...head, ...fused.slice(N)];
}

// ── temporal precedence (US I6) ─────────────────────────────────────────────
// Deterministic, metadata-driven ordering BEFORE the LLM sees the context:
// a chunk marked `temporal: "current"` whose `supersedes` list names another
// selected chunk's sourceId must rank ABOVE that superseded chunk. Historical
// chunks are never dropped from the index — they only lose the tie when the
// current counterpart was also retrieved for the same query (e.g. the frozen
// May-2026 proposal's model plan vs the model card's executed results). If the
// current chunk was in the fused pool but MMR left it out while a superseded
// one made the cut, it is swapped IN (the tail is trimmed to keep k constant).
export function applyTemporalPrecedence(selected, fusedOrder, chunks) {
  if (!selected.length) return selected;
  const currents = fusedOrder.filter(
    (i) => chunks[i]?.temporal === "current" && Array.isArray(chunks[i].supersedes) && chunks[i].supersedes.length,
  );
  if (!currents.length) return selected;
  const out = [...selected];
  const k0 = out.length;
  for (const ci of currents) {
    const sup = new Set(chunks[ci].supersedes);
    const victimAt = () =>
      out.findIndex((i) => i !== ci && chunks[i]?.temporal !== "current" && sup.has(chunks[i]?.sourceId));
    const v = victimAt();
    if (v === -1) continue; // nothing it supersedes was selected
    const pos = out.indexOf(ci);
    if (pos !== -1 && pos < v) continue; // already ranked above its victim
    if (pos !== -1) out.splice(pos, 1); // lift within the selection…
    out.splice(victimAt(), 0, ci); // …to just above the first superseded chunk
    out.length = Math.min(out.length, k0); // swapped in from the pool → trim tail
  }
  return out;
}

// Full retrieval pipeline, single-sourced so engine.ts and every rag-*.mjs eval
// rank identically. Returns fused indices (for MRR/nDCG) + the MMR-selected
// top-k (for recall / the answer). `qv` is the query vector or null (pre-consent
// BM25-only). `bm25` is the { docTf, docLen, idf, avgdl } from buildBM25.
export function retrieveRanked({ chunks, vectors, dim, bm25, query, qv, lang, k, rerankVariant = "v1" }) {
  const qTokensRaw = tokenize(query);
  // Empty-token query (all stopwords / OOV) with no dense signal → surface the
  // top self-contained glossary/fact chunks instead of returning nothing.
  if (qTokensRaw.length === 0 && !qv) {
    const fb = [];
    for (let i = 0; i < chunks.length && fb.length < k; i++)
      if (chunks[i].lang === lang && (chunks[i].kind === "glossary" || chunks[i].kind === "fact")) fb.push(i);
    return { fused: fb, selected: fb };
  }
  const qTokens = expandQuery(qTokensRaw);
  // Cross-lingual: broaden to all chunks when the pool is thin OR the query's
  // language differs from the page locale (off-locale chunks are penalized in
  // the reranker so same-locale still dominates).
  let pool = chunks.map((_, i) => i).filter((i) => chunks[i].lang === lang);
  if (pool.length < k * 3 || detectQueryLang(query) !== lang) pool = chunks.map((_, i) => i);
  const lex = bm25Rank(bm25, qTokens, pool);
  const dense = qv ? denseRank(vectors, dim, qv, pool) : [];
  let fused = rrfFuse(lex, dense);
  if (fused.length === 0) return { fused: [], selected: [] };
  fused = rerankFused(fused, chunks, qTokensRaw, lang, query, rerankVariant);
  const fusedIdx = fused.map((x) => x.i);
  const selected = applyTemporalPrecedence(mmrSelect(vectors, dim, fused, k, dense.length > 0), fusedIdx, chunks);
  return { fused: fusedIdx, selected };
}
