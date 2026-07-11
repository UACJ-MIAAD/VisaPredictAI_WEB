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

const checks = [
  ["next_static_total_mb", join(OUT, "_next", "static")],
  ["data_total_mb", join(OUT, "data")],
  ["rag_index_total_mb", join(OUT, "rag")],
  ["ort_wasm_total_mb", join(OUT, "ort")],
];
for (const [key, dir] of checks) {
  if (!existsSync(dir)) { problems.push(`${key}: ${dir} ausente del export`); continue; }
  const got = mb(dirSize(dir));
  const cap = BUDGETS[key];
  console.log(`  ${got <= cap ? "✓" : "✗"} ${key}: ${got.toFixed(1)} MB (techo ${cap} MB)`);
  if (got > cap) problems.push(`${key}: ${got.toFixed(1)} MB > techo ${cap} MB`);
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
