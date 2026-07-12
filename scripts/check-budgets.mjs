// F3 (plan auditoría 2026-07-11): presupuestos de peso del export + higiene de
// variantes de imagen. Corre tras verify-build en el build offline de CI: una
// regresión material de peso o una variante AVIF/WebP faltante/contraproducente
// falla el PR. Los techos viven versionados en docs/perf_budgets.json.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "out");
const BUDGETS = JSON.parse(readFileSync(join(process.cwd(), "docs", "perf_budgets.json"), "utf8"));
const problems = [];

function dirSize(dir) {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}
const mb = (b) => b / 1024 / 1024;

// rag/ y ort/ los produce build-rag-index.mjs (gitignored) — el build:offline de
// CI lo salta a propósito (sin modelo HF), así que ahí NUNCA existen: su ausencia
// se reporta fuerte pero no falla (optional). Su existencia en el deploy path la
// gatean build-rag-index + rag:gate; este script solo gatea TAMAÑO donde existan.
const checks = [
  ["next_static_total_mb", join(OUT, "_next", "static"), false],
  ["data_total_mb", join(OUT, "data"), false],
  ["rag_index_total_mb", join(OUT, "rag"), true],
  ["ort_wasm_total_mb", join(OUT, "ort"), true],
];
for (const [key, dir, optional] of checks) {
  if (!existsSync(dir)) {
    if (optional) { console.log(`  ~ ${key}: n/a (build-rag-index no corrió en este build)`); continue; }
    problems.push(`${key}: ${dir} ausente del export`); continue;
  }
  const got = mb(dirSize(dir));
  const cap = BUDGETS[key];
  console.log(`  ${got <= cap ? "✓" : "✗"} ${key}: ${got.toFixed(1)} MB (techo ${cap} MB)`);
  if (got > cap) problems.push(`${key}: ${got.toFixed(1)} MB > techo ${cap} MB`);
}

// US I6 — capa por capa del RAG (solo si el build de deploy lo produjo): el
// índice se sirve por capas y cada una tiene su presupuesto propio —
//   chunks.json   pre-consentimiento (warmUp, BM25): DEBE ser ≪ el monolito.
//   vectors.f16   post-consentimiento (motor semántico): f16 crudo.
//   index.json    monolito para las evals (rag-golden-eval / rag-eval / selfcheck
//                 lo leen local y contra prod) — el navegador NO lo descarga.
// Si out/rag existe, las tres capas deben existir (un deploy sin chunks.json
// dejaría al bot sin arranque léxico).
if (existsSync(join(OUT, "rag"))) {
  const kb = (p) => statSync(p).size / 1024;
  for (const [file, capKey] of [
    ["chunks.json", "rag_preconsent_chunks_kb"],
    ["vectors.f16", "rag_vectors_kb"],
    ["index.json", null], // presencia: lo consumen las evals desplegadas; su peso lo gatea rag_index_total_mb
  ]) {
    const p = join(OUT, "rag", file);
    if (!existsSync(p)) { problems.push(`rag/${file} ausente del export (capa I6)`); continue; }
    if (!capKey) continue;
    const got = kb(p);
    const cap = BUDGETS[capKey];
    console.log(`  ${got <= cap ? "✓" : "✗"} ${capKey}: ${got.toFixed(0)} kB (techo ${cap} kB)`);
    if (got > cap) problems.push(`${capKey}: ${got.toFixed(0)} kB > techo ${cap} kB`);
  }
}

// Chunk JS más pesado.
const chunksDir = join(OUT, "_next", "static", "chunks");
let biggest = 0;
for (const f of readdirSync(chunksDir)) {
  if (f.endsWith(".js")) biggest = Math.max(biggest, statSync(join(chunksDir, f)).size / 1024);
}
console.log(`  ${biggest <= BUDGETS.largest_js_chunk_kb ? "✓" : "✗"} largest_js_chunk: ${biggest.toFixed(0)} kB (techo ${BUDGETS.largest_js_chunk_kb} kB)`);
if (biggest > BUDGETS.largest_js_chunk_kb) problems.push(`chunk JS de ${biggest.toFixed(0)} kB > techo`);

// Higiene de variantes: cada PNG de galería lleva AVIF (menor que el PNG — si no,
// la variante moderna es contraproducente) y WebP (siempre presente por contrato
// <picture>; se elige el menor lossy/lossless en build, no se exige < PNG).
let pngs = 0, missing = 0, counterproductive = 0;
function walkGallery(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walkGallery(p); continue; }
    if (!e.name.endsWith(".png")) continue;
    pngs++;
    const avif = p.replace(/\.png$/, ".avif");
    const webp = p.replace(/\.png$/, ".webp");
    if (!existsSync(avif) || !existsSync(webp)) { missing++; continue; }
    if (statSync(avif).size >= statSync(p).size) counterproductive++;
  }
}
for (const g of ["eda", "fe"]) walkGallery(join(OUT, "data", g));
console.log(`  ${missing === 0 && counterproductive === 0 ? "✓" : "✗"} imágenes: ${pngs} PNG, ${missing} sin variantes, ${counterproductive} AVIF contraproducentes`);
if (missing) problems.push(`${missing} PNG de galería sin variantes AVIF/WebP`);
if (counterproductive) problems.push(`${counterproductive} AVIF >= su PNG (variante contraproducente)`);

if (problems.length) {
  console.error(`check-budgets: ✗ ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("check-budgets: ✓ export dentro de presupuesto; variantes de imagen sanas");
