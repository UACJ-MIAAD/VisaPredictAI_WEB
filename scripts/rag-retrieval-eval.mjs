// Época 0 — OFFLINE retrieval benchmark. Auto-generates probes from the index's
// glossary chunks (query = term, target = that chunk) and measures recall@k, MRR
// and nDCG@k against the engine's retrieval (dense e5 + BM25 + RRF, with the
// fused ranking for MRR/nDCG and post-MMR top-6 for recall). No network, no
// Claude — fast + free, so it can be re-run after every indexing change to
// prove a gain. Run: node scripts/rag-retrieval-eval.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const idx = JSON.parse(readFileSync(join(root, "public", "rag", "index.json"), "utf8"));

const STOP = new Set("de la el los las un una unos unas y o a en que es del al se su por con para the a an of to in is are and or for on with that this it as by be from at qué que como cómo cuál cuales donde dónde es son está están".split(" "));
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tok = (s) => fold(s).replace(/[^a-z0-9_]+/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

// decode vectors + BM25 (mirror engine.ts; uses chunk.embedCtx if present)
const bin = atob(idx.vectors); const by = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
const vectors = new Float32Array(by.buffer); const dim = idx.dim; const chunks = idx.chunks;
const idxText = (c) => `${c.embedCtx ? c.embedCtx + " " : ""}${c.title} ${c.text}`;
const docTf = [], docLen = [], df = new Map();
for (const c of chunks) { const ts = tok(idxText(c)); const tf = new Map(); for (const t of ts) tf.set(t, (tf.get(t) || 0) + 1); for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1); docTf.push(tf); docLen.push(ts.length); }
const N = chunks.length, idf = new Map();
for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
const avgdl = docLen.reduce((a, b) => a + b, 0) / Math.max(1, N);

function rank(qv, qt, lang) {
  let pool = chunks.map((_, i) => i).filter((i) => chunks[i].lang === lang);
  if (pool.length < 18) pool = chunks.map((_, i) => i);
  const k1 = 1.5, b = 0.75;
  const lex = pool.map((i) => { let s = 0; for (const t of qt) { const f = docTf[i].get(t); if (!f) continue; s += (idf.get(t) || 0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * docLen[i]) / avgdl))); } return { i, s }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40);
  const dense = pool.map((i) => { let s = 0; const o = i * dim; for (let k = 0; k < dim; k++) s += qv[k] * vectors[o + k]; return { i, s }; }).sort((a, b) => b.s - a.s).slice(0, 40);
  const rrf = new Map(); lex.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r))); dense.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r)));
  const fused = [...rrf.entries()].map(([i, s]) => ({ i, s })).sort((a, b) => b.s - a.s);
  // MMR top-6 (mirror engine λ=0.7) for recall@6
  const cos = (a, c) => { let s = 0; for (let k = 0; k < dim; k++) s += vectors[a * dim + k] * vectors[c * dim + k]; return s; };
  const cand = fused.slice(0, 24); const sel = [];
  while (sel.length < 6 && cand.length) { let best = -1, bs = -Infinity; const mr = cand[0].s || 1; for (let ci = 0; ci < cand.length; ci++) { const { i, s } = cand[ci]; let div = sel.length ? Math.max(...sel.map((j) => cos(i, j))) : 0; const sc = 0.7 * (s / mr) - 0.3 * div; if (sc > bs) { bs = sc; best = ci; } } sel.push(cand[best].i); cand.splice(best, 1); }
  return { fused: fused.map((x) => x.i), mmr: sel };
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
  const { fused, mmr } = rank(await embed(p.q), tok(p.q), p.lang);
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
];
let aHit = 0, aRankSum = 0;
for (const p of ACAD) {
  const { fused } = rank(await embed(p.q), tok(p.q), p.lang);
  const r = fused.findIndex((i) => p.src.test(chunks[i].source)) + 1;
  if (r && r <= 6) aHit++;
  aRankSum += r || 99;
}
console.log(`ACADEMIC/fragment probes (${ACAD.length}, where contextual helps):`);
console.log(`  source-hit@6: ${Math.round((aHit / ACAD.length) * 100)}% (${aHit}/${ACAD.length})  mean best-rank: ${(aRankSum / ACAD.length).toFixed(1)}`);
