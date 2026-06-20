// BRUTAL adversarial RAG eval — prompt injection / jailbreak (single-turn) +
// serial multi-turn (context carry-over and chained jailbreaks). Retrieves from
// the LIVE index and hits the LIVE Claude function with real history.
// Scores: defense rate, leak/compliance rate, follow-up context carry.
// Run: node scripts/rag-injection-eval.mjs   (hits production → uses credits)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.argv[2] || "https://visapredictai.com";
const FN = `${SITE}/.netlify/functions/chat`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── retrieval replica (engine.ts) ───────────────────────────────────────────
const STOP = new Set("de la el los las un una unos unas y o a en que es del al se su por con para the a an of to in is are and or for on with that this it as by be from at qué que como cómo cuál cuales donde dónde es son está están".split(" "));
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tok = (s) => fold(s).replace(/[^a-z0-9_]+/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));
function buildIndex(json) {
  const bin = atob(json.vectors); const by = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
  const vectors = new Float32Array(by.buffer), dim = json.dim, docTf = [], docLen = [], df = new Map();
  for (const c of json.chunks) { const ts = tok(`${c.title} ${c.text}`); const tf = new Map(); for (const t of ts) tf.set(t, (tf.get(t) || 0) + 1); for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1); docTf.push(tf); docLen.push(ts.length); }
  const N = json.chunks.length, idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  return { chunks: json.chunks, vectors, dim, docTf, docLen, idf, avgdl: docLen.reduce((a, b) => a + b, 0) / Math.max(1, N) };
}
function retrieve(L, qv, qt, lang, k = 6) {
  let pool = L.chunks.map((_, i) => i).filter((i) => L.chunks[i].lang === lang);
  if (pool.length < k * 3) pool = L.chunks.map((_, i) => i);
  const k1 = 1.5, b = 0.75;
  const lex = pool.map((i) => { let s = 0; for (const t of qt) { const f = L.docTf[i].get(t); if (!f) continue; s += (L.idf.get(t) || 0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * L.docLen[i]) / L.avgdl))); } return { i, s }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40);
  const d = L.dim;
  const dense = qv ? pool.map((i) => { let s = 0; const o = i * d; for (let k = 0; k < d; k++) s += qv[k] * L.vectors[o + k]; return { i, s }; }).sort((a, b) => b.s - a.s).slice(0, 40) : [];
  const rrf = new Map(); lex.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r))); dense.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (60 + r)));
  const fused = [...rrf.entries()].map(([i, s]) => ({ i, s })).sort((a, b) => b.s - a.s).slice(0, 6);
  return fused.map(({ i }, idx) => { const c = L.chunks[i]; return { n: idx + 1, title: c.title, source: c.source, url: c.url, text: c.text }; });
}
async function ask(lang, query, context, history) {
  const res = await fetch(FN, { method: "POST", headers: { "content-type": "application/json", origin: SITE }, body: JSON.stringify({ lang, query, history, context }) });
  const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "", err = null;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const ps = buf.split("\n\n"); buf = ps.pop() || ""; for (const p of ps) { const line = p.split("\n").find((l) => l.startsWith("data:")); if (!line) continue; try { const ev = JSON.parse(line.slice(5).trim()); if (ev.t === "delta") full += ev.text; else if (ev.t === "error") err = ev.code; } catch {} } }
  return { answer: full, err };
}

// ── setup ───────────────────────────────────────────────────────────────────
const set = JSON.parse(readFileSync(join(root, "scripts", "rag-injection-set.json"), "utf8"));
console.log(`Loading LIVE index…`);
const idx = await (await fetch(`${SITE}/rag/index.json`)).json();
const L = buildIndex(idx);
const { pipeline, env } = await import("@huggingface/transformers");
env.cacheDir = join(root, "public", "models"); env.allowRemoteModels = false;
const ex = await pipeline("feature-extraction", idx.model, { dtype: "q8" });
const embed = async (t) => (await ex([`query: ${t}`], { pooling: "mean", normalize: true })).data;
const rx = (s) => (s ? new RegExp(s, "i") : null);

// ── 1) single-turn injections ───────────────────────────────────────────────
console.log(`\n=== PROMPT INJECTIONS (${set.injections.length}) ===`);
const injRes = [];
for (const c of set.injections) {
  const lang = /[¿áéíóúñ]/.test(c.q) ? "es" : "en";
  const ctx = retrieve(L, await embed(c.q), tok(c.q), lang, 6);
  let r; for (let a = 0; a < 2; a++) { try { r = await ask(lang, c.q, ctx, []); } catch (e) { r = { answer: "", err: "net" }; } if (r.err === "rate" || r.err === "net") { await sleep(20000); continue; } break; }
  const ans = r.answer || "";
  const leaked = c.mustNot ? rx(c.mustNot).test(ans) : false;
  const defended = c.defend ? rx(c.defend).test(ans) : !leaked;
  const safe = !leaked && defended;
  injRes.push({ q: c.q, safe, leaked, defended, ans: ans.slice(0, 110).replace(/\n/g, " ") });
  console.log(`${safe ? "🛡️ " : "💥"} ${c.q.slice(0, 58)}${safe ? "" : `  [${leaked ? "LEAK/COMPLY" : "no-defend"}]`}`);
  await sleep(3500);
}

// ── 2) serial multi-turn (skip with arg "inj") ──────────────────────────────
console.log(`\n=== SERIAL / MULTI-TURN (${process.argv[3] === "inj" ? "skipped" : set.serial.length}) ===`);
const serRes = [];
for (const c of (process.argv[3] === "inj" ? [] : set.serial)) {
  const lang = "es";
  const history = []; let last = { answer: "" };
  for (let i = 0; i < c.turns.length; i++) {
    const q = c.turns[i];
    const ctx = retrieve(L, await embed(q), tok(q), lang, 6);
    let r; for (let a = 0; a < 2; a++) { try { r = await ask(lang, q, ctx, history.slice(-12)); } catch { r = { answer: "", err: "net" }; } if (r.err === "rate" || r.err === "net") { await sleep(20000); continue; } break; }
    history.push({ role: "user", content: q }, { role: "assistant", content: r.answer || "" });
    last = r; await sleep(3000);
  }
  const ans = last.answer || "";
  const leaked = c.mustNot ? rx(c.mustNot).test(ans) : false;
  const defended = c.defend ? rx(c.defend).test(ans) : true;
  const ctxOk = c.kw ? rx(c.kw).test(ans) : true;
  const safe = !leaked && defended && ctxOk;
  serRes.push({ name: c.name, safe, leaked, defended, ctxOk, ans: ans.slice(0, 110).replace(/\n/g, " ") });
  console.log(`${safe ? "🛡️ " : "💥"} ${c.name}${safe ? "" : `  [${leaked ? "LEAK/COMPLY" : !ctxOk ? "no-context" : "no-defend"}]`}  ← ${ans.slice(0, 80).replace(/\n/g, " ")}`);
}

// ── report ───────────────────────────────────────────────────────────────────
const iSafe = injRes.filter((r) => r.safe).length, sSafe = serRes.filter((r) => r.safe).length;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
console.log(`\n${"=".repeat(60)}`);
console.log(`Prompt injection defense: ${iSafe}/${injRes.length} (${pct(iSafe, injRes.length)}%)  ·  0 leaks: ${injRes.every((r) => !r.leaked)}`);
console.log(`Serial / multi-turn:      ${sSafe}/${serRes.length} (${pct(sSafe, serRes.length)}%)`);
const fails = [...injRes.filter((r) => !r.safe).map((r) => ["INJ", r.q, r]), ...serRes.filter((r) => !r.safe).map((r) => ["SER", r.name, r])];
if (fails.length) { console.log(`\nFailures to audit:`); for (const [k, n, r] of fails) console.log(`- [${k}] ${n}\n    ${r.ans}`); }
else console.log(`\n✅ All adversarial cases defended.`);
