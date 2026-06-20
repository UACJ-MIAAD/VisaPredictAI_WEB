// VisaBot RAG eval — BRUTAL live test. For each question: retrieve from the
// LIVE index (e5 q8 + BM25 → RRF → MMR, faithful replica of engine.ts), POST to
// the LIVE function (real Claude), and score: retrieval recall@6, citation
// grounding, keyword grounding, off-topic refusal, latency, errors.
// Mirrors EpiBot's tests/rag_eval.json + run_tests.js methodology.
// Run: node scripts/rag-eval.mjs   (hits production → consumes Claude credits)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.argv[2] || "https://visapredictai.com";
const FN = `${SITE}/.netlify/functions/chat`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── retrieval replica of components/visabot/engine.ts ───────────────────────
const STOP = new Set(("de la el los las un una unos unas y o a en que es del al se su por con para the a an of to in is are and or for on with that this it as by be from at qué que como cómo cuál cuales donde dónde es son está están").split(" "));
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tokenize = (s) => fold(s).replace(/[^a-z0-9_]+/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

function buildIndex(json) {
  const bin = atob(json.vectors);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const vectors = new Float32Array(bytes.buffer);
  const dim = json.dim;
  const docTf = [], docLen = [], df = new Map();
  for (const c of json.chunks) {
    const toks = tokenize(`${c.title} ${c.text}`);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docTf.push(tf); docLen.push(toks.length);
  }
  const N = json.chunks.length;
  const idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  const avgdl = docLen.reduce((a, b) => a + b, 0) / Math.max(1, N);
  return { chunks: json.chunks, vectors, dim, docTf, docLen, idf, avgdl };
}

function retrieve(L, qv, qTokens, lang, k = 6) {
  let pool = L.chunks.map((_, i) => i).filter((i) => L.chunks[i].lang === lang);
  if (pool.length < k * 3) pool = L.chunks.map((_, i) => i);
  const k1 = 1.5, b = 0.75;
  const lex = pool.map((i) => {
    let s = 0;
    for (const t of qTokens) { const f = L.docTf[i].get(t); if (!f) continue; const idf = L.idf.get(t) || 0; s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * L.docLen[i]) / L.avgdl))); }
    return { i, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40);
  const d = L.dim;
  const dense = pool.map((i) => { let s = 0; const off = i * d; for (let kk = 0; kk < d; kk++) s += qv[kk] * L.vectors[off + kk]; return { i, s }; }).sort((a, b) => b.s - a.s).slice(0, 40);
  const rrf = new Map();
  lex.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r)));
  dense.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r)));
  const fused = [...rrf.entries()].map(([i, s]) => ({ i, s })).sort((a, b) => b.s - a.s);
  if (!fused.length) return [];
  const cos = (a, c) => { let s = 0; for (let kk = 0; kk < d; kk++) s += L.vectors[a * d + kk] * L.vectors[c * d + kk]; return s; };
  const cand = fused.slice(0, Math.max(k * 4, 16));
  const sel = [];
  while (sel.length < k && cand.length) {
    let best = -1, bestScore = -Infinity; const maxRel = cand[0].s || 1;
    for (let ci = 0; ci < cand.length; ci++) {
      const { i, s } = cand[ci];
      let div = 0; if (sel.length) div = Math.max(...sel.map((j) => cos(i, j)));
      const sc = 0.7 * (s / maxRel) - 0.3 * div;
      if (sc > bestScore) { bestScore = sc; best = ci; }
    }
    sel.push(cand[best].i); cand.splice(best, 1);
  }
  return sel.map((i, idx) => { const c = L.chunks[i]; return { n: idx + 1, title: c.title, source: c.source, url: c.url, text: c.text }; });
}

// ── live generation ─────────────────────────────────────────────────────────
async function ask(lang, query, context) {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify({ lang, query, history: [], context }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "", err = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop() || "";
    for (const p of parts) {
      const line = p.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try { const ev = JSON.parse(line.slice(5).trim()); if (ev.t === "delta") full += ev.text; else if (ev.t === "error") err = ev.code; } catch { /**/ }
    }
  }
  return { answer: full, err, status: res.status };
}

// ── main ────────────────────────────────────────────────────────────────────
const LIMIT = Number(process.argv[3]) || Infinity;
const set = JSON.parse(readFileSync(join(root, "scripts", "rag-eval-set.json"), "utf8")).cases.slice(0, LIMIT);
console.log(`Loading LIVE index from ${SITE}/rag/index.json …`);
const idxJson = await (await fetch(`${SITE}/rag/index.json`)).json();
const L = buildIndex(idxJson);
console.log(`  index: ${L.chunks.length} chunks, ${L.dim}-d`);

const { pipeline, env } = await import("@huggingface/transformers");
env.cacheDir = join(root, "public", "models");
env.allowRemoteModels = false;
const extractor = await pipeline("feature-extraction", idxJson.model, { dtype: "q8" });
const embed = async (t) => (await extractor([`query: ${t}`], { pooling: "mean", normalize: true })).data;

const REFUSE_RE = /no encuentro|no.*encontr|no.*dispong|no.*relacion|fuera de|can.?t find|couldn.?t find|not.*find|no.*documentaci|not.*documentation|no puedo ayudar|cannot help|no tengo informaci|don.?t have|solo puedo|s[oó]lo.*ayud|only help|only assist|specialized assistant|asistente especializ|i'?m visabot|soy.*visabot/i;
const results = [];
console.log(`Running ${set.length} questions against ${FN} …\n`);

for (let i = 0; i < set.length; i++) {
  const q = set[i];
  const qv = await embed(q.q);
  const sources = retrieve(L, qv, tokenize(q.q), q.lang, 6);
  let r, t0 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try { r = await ask(q.lang, q.q, sources); } catch (e) { r = { answer: "", err: "network:" + e.message, status: 0 }; }
    if (r.err === "rate" || r.status === 504 || r.err?.startsWith("network")) { await sleep(20000); t0 = Date.now(); continue; }
    break;
  }
  const ms = Date.now() - t0;
  const ans = r.answer || "";
  const answered = !r.err && ans.length > 0;
  const cited = /\[\d+\]/.test(ans);
  const kwPass = q.kw ? new RegExp(q.kw, "i").test(ans) : null;
  const srcPass = q.src ? sources.some((s) => new RegExp(q.src, "i").test(s.source)) : null;
  const refusePass = q.refuse ? REFUSE_RE.test(ans) : null;
  const greetPass = q.greet ? (answered && ans.length > 3) : null;
  const citeExpected = !q.greet && !q.refuse && q.cat !== "guardrail";
  const checks = [answered, kwPass, srcPass, refusePass, greetPass, citeExpected ? cited : null].filter((x) => x !== null);
  const pass = checks.every(Boolean);
  results.push({ ...q, ms, answered, cited, kwPass, srcPass, refusePass, greetPass, pass, err: r.err, top: sources.slice(0, 3).map((s) => s.source), ans: ans.slice(0, 140).replace(/\n/g, " ") });
  process.stdout.write(`${pass ? "✓" : "✗"} [${q.cat}] ${q.q.slice(0, 52)}${pass ? "" : "  ← " + [!answered && "no-answer", kwPass === false && "kw", srcPass === false && "recall", refusePass === false && "no-refuse", citeExpected && !cited && "no-cite"].filter(Boolean).join(",")}\n`);
  await sleep(3500); // pace under the 20/min function rate limit
}

// ── aggregate ───────────────────────────────────────────────────────────────
const n = results.length, passed = results.filter((r) => r.pass).length;
const byCat = {};
for (const r of results) { (byCat[r.cat] ??= []).push(r); }
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const lat = results.map((r) => r.ms).sort((a, b) => a - b);
const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
const recallN = results.filter((r) => r.srcPass !== null);
const citeN = results.filter((r) => !r.greet && !r.refuse && r.cat !== "guardrail");
const kwN = results.filter((r) => r.kwPass !== null);
const refuseN = results.filter((r) => r.refuse);
const errs = results.filter((r) => r.err);

let out = `# VisaBot RAG eval — ${SITE}\n\n`;
out += `**Overall: ${passed}/${n} (${pct(passed, n)}%)**\n\n`;
out += `| Metric | Value |\n|---|---|\n`;
out += `| Retrieval recall@6 (expected source in top-6) | ${pct(recallN.filter((r) => r.srcPass).length, recallN.length)}% (${recallN.filter((r) => r.srcPass).length}/${recallN.length}) |\n`;
out += `| Citation grounding (factual Qs that cite [n]) | ${pct(citeN.filter((r) => r.cited).length, citeN.length)}% (${citeN.filter((r) => r.cited).length}/${citeN.length}) |\n`;
out += `| Keyword grounding (answer contains expected concept) | ${pct(kwN.filter((r) => r.kwPass).length, kwN.length)}% (${kwN.filter((r) => r.kwPass).length}/${kwN.length}) |\n`;
out += `| Off-topic refusal accuracy | ${pct(refuseN.filter((r) => r.refusePass).length, refuseN.length)}% (${refuseN.filter((r) => r.refusePass).length}/${refuseN.length}) |\n`;
out += `| Answered (no error) | ${pct(results.filter((r) => r.answered).length, n)}% |\n`;
out += `| Latency p50 / p95 | ${p(0.5)} ms / ${p(0.95)} ms |\n`;
out += `| Errors | ${errs.length} |\n\n`;
out += `## By category\n\n| Category | Pass | Rate |\n|---|---|---|\n`;
for (const [c, rs] of Object.entries(byCat).sort()) out += `| ${c} | ${rs.filter((r) => r.pass).length}/${rs.length} | ${pct(rs.filter((r) => r.pass).length, rs.length)}% |\n`;
const fails = results.filter((r) => !r.pass);
out += `\n## Failures (${fails.length})\n\n`;
for (const f of fails) out += `- **[${f.cat}]** ${f.q}\n  - reasons: ${[!f.answered && "no-answer(" + f.err + ")", f.kwPass === false && "kw-miss", f.srcPass === false && `recall-miss (top: ${f.top.join(", ")})`, f.refusePass === false && "did-not-refuse", (!f.greet && !f.refuse && f.cat !== "guardrail" && !f.cited) && "no-citation"].filter(Boolean).join("; ")}\n  - answer: ${f.ans}\n`;

const reportPath = "/tmp/visabot-rageval-report.md";
writeFileSync(reportPath, out);
console.log(`\n${"=".repeat(60)}\n${out.split("## Failures")[0]}`);
console.log(`Full report → ${reportPath}`);
