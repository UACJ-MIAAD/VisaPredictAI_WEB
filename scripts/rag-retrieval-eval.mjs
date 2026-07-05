// Época 0 — OFFLINE retrieval benchmark. Auto-generates probes from the index's
// glossary chunks (query = term, target = that chunk) and measures recall@k, MRR
// and nDCG@k against the engine's retrieval (dense e5 + BM25 + RRF, with the
// fused ranking for MRR/nDCG and post-MMR top-6 for recall). No network, no
// Claude — fast + free, so it can be re-run after every indexing change to
// prove a gain. Run: node scripts/rag-retrieval-eval.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { buildBM25, retrieveRanked } from "../lib/visabot/retrieval-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const idx = JSON.parse(readFileSync(join(root, "public", "rag", "index.json"), "utf8"));

// decode vectors; BM25 comes from the shared retrieval-core (single source with
// engine.ts — embedCtx-aware, code-normalized tokenizer).
const bin = atob(idx.vectors); const by = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
const vectors = new Float32Array(by.buffer); const dim = idx.dim; const chunks = idx.chunks;
const L = buildBM25(chunks);

// Full pipeline via the shared core (expand → cross-lingual → BM25+dense → RRF →
// rerank → MMR) so the gate measures exactly what engine.ts ships.
function rank(qv, lang, query) {
  const { fused, selected } = retrieveRanked({ chunks, vectors, dim, bm25: L, query, qv, lang, k: 6 });
  return { fused, mmr: selected };
}

const { pipeline, env } = await import("@huggingface/transformers");
env.cacheDir = join(root, "public", "models"); env.allowRemoteModels = false;
const ex = await pipeline("feature-extraction", idx.model, { dtype: "q8" });
const embed = async (t) => (await ex([`query: ${t}`], { pooling: "mean", normalize: true })).data;

// probes: one per glossary chunk → "¿Qué es {term}?" must retrieve that chunk
const probes = chunks.map((c, i) => ({ i, c })).filter((p) => p.c.kind === "glossary").map((p) => ({
  target: p.i, lang: p.c.lang,
  q: p.c.lang === "en" ? `What is ${p.c.title}?` : `¿Qué es ${p.c.title}?`,
}));

let r1 = 0, r6 = 0, mrrSum = 0, ndcgSum = 0;
for (const p of probes) {
  const { fused, mmr } = rank(await embed(p.q), p.lang, p.q);
  const fusedRank = fused.indexOf(p.target) + 1; // 1-based; 0 → not found
  if (mmr[0] === p.target) r1++;
  if (mmr.includes(p.target)) r6++;
  mrrSum += fusedRank ? 1 / fusedRank : 0;
  ndcgSum += fusedRank && fusedRank <= 10 ? 1 / Math.log2(fusedRank + 1) : 0; // single relevant → nDCG@10 = 1/log2(rank+1)
}
const n = probes.length, pct = (x) => `${Math.round((x / n) * 100)}%`;
console.log(`\nRETRIEVAL BENCHMARK · index built ${idx.built?.slice(0, 10)} · contextual prefix: ${chunks.some((c) => c.embedCtx) ? "ON (academic/docs)" : "OFF"}`);
console.log(`GLOSSARY probes (${n}, self-contained — guards against dilution):`);
console.log(`  recall@1: ${pct(r1)} (${r1}/${n})  recall@6: ${pct(r6)} (${r6}/${n})  MRR: ${(mrrSum / n).toFixed(3)}  nDCG@10: ${(ndcgSum / n).toFixed(3)}`);

// BM25-ONLY (pre-consent default): the lexical-only ranking EVERY first-time
// visitor hits before the ~150 MB semantic download. Previously unmeasured.
let b1 = 0, b6 = 0;
for (const p of probes) {
  const { mmr } = rank(null, p.lang, p.q); // qv=null → BM25-only
  if (mmr[0] === p.target) b1++;
  if (mmr.includes(p.target)) b6++;
}
console.log(`  BM25-only (pre-consent): recall@1 ${pct(b1)} (${b1}/${n})  recall@6 ${pct(b6)} (${b6}/${n})`);

// ACADEMIC/fragment probes (where contextual retrieval should help): query → expected source (regex)
const ACAD = [
  { q: "¿cómo se valida el pronóstico sin fuga de datos?", src: /metodolog|crisp|producto|validaci|IV/i, lang: "es" },
  { q: "¿qué significan los estados C, F y U?", src: /diccionario|datos|modelo|panel|marco/i, lang: "es" },
  { q: "¿cuál es la fecha base de normalización de los datos?", src: /diccionario|datos|modelo|panel/i, lang: "es" },
  { q: "¿qué horizontes de pronóstico considera el sistema?", src: /producto|metodolog|resumen|marco/i, lang: "es" },
  { q: "¿por qué solo se entrena sobre observaciones finales?", src: /producto|metodolog|datos|marco/i, lang: "es" },
  { q: "how is the multi-series panel structured?", src: /data|panel|model|repo|engineer|datos/i, lang: "en" },
  { q: "which methodology does the project follow?", src: /method|crisp|product|IV/i, lang: "en" },
  { q: "what error metrics does the project use?", src: /metodolog|marco|product|model|method|framework/i, lang: "es" },
  // Audit round 2: the seeded suggestion must retrieve the CURRENT results
  // (model card), not the frozen May proposal — in both languages. These are the
  // FLAGSHIP probes and get their own 100 % gate (finding 14: otherwise one
  // flagship paraphrase could regress and still ship, diluted in the acadHit avg).
  { q: "¿Qué modelos compara el proyecto y cuál gana?", src: /model card/i, lang: "es", flagship: true },
  { q: "Which models does the project compare and which one wins?", src: /model card/i, lang: "en", flagship: true },
  // Audit round 3: natural PARAPHRASES must reach the verdict too, not just the
  // exact seeded suggestion (BM25 fell back to the May proposal otherwise).
  { q: "¿cuál es el mejor modelo?", src: /model card/i, lang: "es", flagship: true },
  { q: "¿cuántos modelos compararon?", src: /model card/i, lang: "es", flagship: true },
  { q: "which is the best model?", src: /model card/i, lang: "en", flagship: true },
];
let aHit = 0, aRankSum = 0, flagN = 0, flagHit = 0;
const probeLog = [];
for (const p of ACAD) {
  const { fused } = rank(await embed(p.q), p.lang, p.q);
  const r = fused.findIndex((i) => p.src.test(chunks[i].source)) + 1;
  const hit = r && r <= 6;
  if (hit) aHit++;
  else console.log(`  MISS: "${p.q}" → best-rank ${r || "none"}`);
  if (p.flagship) { flagN++; if (hit) flagHit++; }
  aRankSum += r || 99;
  probeLog.push({ q: p.q, lang: p.lang, rank: r || null, hit: !!hit, flagship: !!p.flagship });
}
console.log(`ACADEMIC/fragment probes (${ACAD.length}, where contextual helps):`);
console.log(`  source-hit@6: ${Math.round((aHit / ACAD.length) * 100)}% (${aHit}/${ACAD.length})  mean best-rank: ${(aRankSum / ACAD.length).toFixed(1)}`);
console.log(`  flagship "which model wins" probes: ${flagHit}/${flagN} hit@6`);

// Época 5 — CI gate: with --gate, fail (exit 1) if any metric regresses below
// the frozen baseline thresholds. Keeps deploys from silently degrading retrieval.
if (process.argv.includes("--gate")) {
  // Per-probe ranks → machine-readable artifact (OS temp, never shipped) so a
  // regression shows WHICH probe moved, not just an aggregate pass/fail.
  const probesPath = join(tmpdir(), "visabot-gate-probes.json");
  try { writeFileSync(probesPath, JSON.stringify({ built: idx.built, glossary: { recall1: r1 / n, recall6: r6 / n, mrr: mrrSum / n, bm25Recall6: b6 / n }, academic: probeLog }, null, 2)); console.log(`  per-probe ranks → ${probesPath}`); } catch { /* best-effort */ }
  const T = { recall6: 1.0, mrr: 0.95, glossR1: 0.92, acadHit: 0.85, flagship: 1.0, bm25Recall6: 0.90 };
  const m = { recall6: r6 / n, mrr: mrrSum / n, glossR1: r1 / n, acadHit: aHit / ACAD.length, flagship: flagN ? flagHit / flagN : 1, bm25Recall6: b6 / n };
  const fails = Object.entries(T).filter(([k, t]) => m[k] < t).map(([k, t]) => `${k} ${m[k].toFixed(3)} < ${t}`);
  if (fails.length) { console.error(`\n✗ RAG GATE FAILED:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log(`\n✓ RAG gate passed (recall@6 ${m.recall6.toFixed(2)}, MRR ${m.mrr.toFixed(3)}, gloss@1 ${m.glossR1.toFixed(2)}, acad@6 ${m.acadHit.toFixed(2)}, flagship ${m.flagship.toFixed(2)}, bm25@6 ${m.bm25Recall6.toFixed(2)}).`);
}
