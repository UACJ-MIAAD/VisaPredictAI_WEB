// G1 (plan auditoría 2026-07-11): verificación del export de producción en out/.
// Corre tras `next build` + build-csp en el job offline de CI, para que Netlify NUNCA
// sea el primer lugar donde se descubre una regresión de rutas/CSP/assets. Falla
// (exit 1) si falta cualquier invariante del export; imprime el censo al pasar.
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";

const OUT = join(process.cwd(), "out");
const problems = [];
const exists = (p) => access(join(OUT, p)).then(() => true).catch(() => false);

// Rutas críticas (ES en la raíz + espejo /en/) — el conteo total tiene piso aparte,
// así que añadir rutas nuevas no rompe esto; perder una crítica sí.
const CRITICAL_ROUTES = ["", "datos-historicos", "ingenieria", "resultados", "recursos", "anteproyecto"];
for (const r of CRITICAL_ROUTES) {
  for (const base of ["", "en"]) {
    const p = join(base, r, "index.html").replace(/^\//, "");
    if (!(await exists(p))) problems.push(`ruta crítica ausente: /${join(base, r)}/`);
  }
}
if (!(await exists("404.html"))) problems.push("404.html ausente");

// Censo de páginas: piso, no igualdad — crecer no rompe, encoger sí.
async function countPages(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== "_next") n += await countPages(join(dir, e.name));
    else if (e.name === "index.html" || e.name === "404.html") n++;
  }
  return n;
}
const nPages = await countPages(OUT);
// Piso = documentos HTML del export (16 hoy: 7 rutas ES + 7 EN + índices de grupo + 404).
// El "33 páginas" que reporta next build cuenta también rutas no-HTML (og images,
// sitemap, manifest, íconos). Subir el piso al añadir rutas reales.
const MIN_PAGES = 16;
if (nPages < MIN_PAGES) problems.push(`solo ${nPages} documentos HTML exportados (< piso ${MIN_PAGES})`);

// Sitemap bilingüe.
try {
  const sm = await readFile(join(OUT, "sitemap.xml"), "utf8");
  if (!sm.includes("/en/")) problems.push("sitemap.xml sin URLs /en/");
} catch {
  problems.push("sitemap.xml ausente");
}

// OG images (Next las emite con sufijo hash junto a cada segmento).
async function hasOg(dir) {
  return (await readdir(join(OUT, dir)).catch(() => [])).some((f) => f.startsWith("opengraph-image"));
}
if (!(await hasOg(""))) problems.push("og image raíz (ES) ausente");
if (!(await hasOg("en"))) problems.push("og image /en ausente");

// Headers: CSP por página sin 'unsafe-inline' en script-src.
try {
  const headers = await readFile(join(OUT, "_headers"), "utf8");
  if (!/content-security-policy/i.test(headers)) problems.push("_headers sin CSP");
  const badScript = headers
    .split("\n")
    .filter((l) => /content-security-policy/i.test(l))
    .filter((l) => /script-src[^;]*'unsafe-inline'/i.test(l));
  if (badScript.length) problems.push(`${badScript.length} CSP con 'unsafe-inline' en script-src`);
} catch {
  problems.push("out/_headers ausente");
}

// Assets críticos del corte de datos.
for (const a of ["data/visa_panel_long.csv", "data/forecasts.csv", "data/release-state.json", "data/fig_dims.json"]) {
  if (!(await exists(a))) problems.push(`asset crítico ausente: ${a}`);
}

if (problems.length) {
  console.error(`verify-build: ✗ ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`verify-build: ✓ export OK — ${nPages} páginas, rutas críticas ES/EN, sitemap bilingüe, OG, CSP sin unsafe-inline, assets del corte presentes`);
