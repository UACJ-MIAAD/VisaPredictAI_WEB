// VisaBot · retrieval self-check (Épica E4).
// Loads the built index, embeds a few probe queries with the SAME local model,
// decodes the base64 vectors, runs dense cosine retrieval, and asserts the
// expected chunk surfaces in the top-k. Fails loudly if vector serialization,
// dimensions, or alignment break. Run: npm run rag:check
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const idx = JSON.parse(readFileSync(join(root, "public", "rag", "index.json"), "utf8"));
const { dim, chunks } = idx;

// decode base64 → Float32Array, same as the browser does
const buf = Buffer.from(idx.vectors, "base64");
const vecs = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
assert.strictEqual(vecs.length, chunks.length * dim, "vector count != chunks*dim");

const cosine = (a, off) => {
  let s = 0;
  for (let i = 0; i < dim; i++) s += a[i] * vecs[off + i];
  return s; // vectors are L2-normalized at build → dot == cosine
};

const { pipeline, env } = await import("@huggingface/transformers");
env.cacheDir = join(root, "public", "models");
env.allowRemoteModels = false; // must already be local
const extractor = await pipeline("feature-extraction", idx.model, { dtype: "q8" });

const probes = [
  { q: "¿qué es Dates for Filing?", expect: /dates for filing|presentaci/i },
  { q: "what models did the project compare", expect: /sarima|arima|model|theta|ets/i },
  { q: "cómo se construye el panel de datos", expect: /panel|serie|y_|país|categor/i },
];

let pass = 0;
for (const { q, expect } of probes) {
  const out = await extractor([`query: ${q}`], { pooling: "mean", normalize: true });
  const qv = out.data;
  const ranked = chunks
    .map((c, i) => ({ c, score: cosine(qv, i * dim) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const hit = ranked.some((r) => expect.test(`${r.c.title} ${r.c.text}`));
  console.log(`${hit ? "✓" : "✗"} "${q}"\n   top: ${ranked.map((r) => `${r.c.title} (${r.score.toFixed(3)})`).join(" | ")}`);
  if (hit) pass++;
}
console.log(`\n${pass}/${probes.length} probes retrieved a relevant chunk`);
assert.ok(pass === probes.length, "retrieval self-check failed");
console.log("✓ RAG index self-check passed");
