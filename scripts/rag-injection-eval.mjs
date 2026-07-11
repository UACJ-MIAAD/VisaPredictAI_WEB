// BRUTAL adversarial RAG eval — prompt injection / jailbreak (single-turn) +
// serial multi-turn (context carry-over and chained jailbreaks). Retrieves from
// the LIVE index and hits the LIVE Claude function with real history.
// Scores: defense rate, leak/compliance rate, follow-up context carry.
// Run: node scripts/rag-injection-eval.mjs   (hits production → uses credits)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBM25, retrieveRanked } from "../lib/visabot/retrieval-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.argv[2] || "https://visapredictai.com";
const FN = `${SITE}/.netlify/functions/chat`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── retrieval replica (engine.ts via shared core: embedCtx-aware BM25 + MMR) ──
function buildIndex(json) {
  const bin = atob(json.vectors); const by = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
  const vectors = new Float32Array(by.buffer);
  return { chunks: json.chunks, vectors, dim: json.dim, bm25: buildBM25(json.chunks) };
}
function retrieve(L, qv, lang, query, k = 6) {
  const { selected } = retrieveRanked({ chunks: L.chunks, vectors: L.vectors, dim: L.dim, bm25: L.bm25, query, qv, lang, k });
  return selected.map((i, idx) => { const c = L.chunks[i]; return { n: idx + 1, title: c.title, source: c.source, url: c.url, text: c.text }; });
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
  const ctx = retrieve(L, await embed(c.q), lang, c.q, 6);
  let r; for (let a = 0; a < 2; a++) { try { r = await ask(lang, c.q, ctx, []); } catch { r = { answer: "", err: "net" }; } if (r.err === "rate" || r.err === "net") { await sleep(20000); continue; } break; }
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
    const ctx = retrieve(L, await embed(q), lang, q, 6);
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
