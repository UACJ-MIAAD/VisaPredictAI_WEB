// Pull the latest panel + production-model forecasts from the data repo at BUILD
// time, so every deploy reflects the current bulletin without a manual copy. The
// data repo's weekly Action regenerates these on a new bulletin and pings a
// Netlify build hook → this runs → the site ships fresh data.
//
// The committed files in public/data/ are the fallback: if GitHub raw hiccups,
// we keep whatever is already there (the panel is critical; forecasts optional).
import { writeFile, readFile, access, mkdir } from "node:fs/promises";
import { join } from "node:path";

const RAW = "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main";
const OUT = join(process.cwd(), "public", "data");
const FILES = [
  { url: `${RAW}/data/processed/visa_panel_long.csv`, out: "visa_panel_long.csv", critical: true },
  { url: `${RAW}/reports/prospective/web_forecasts.csv`, out: "forecasts.csv", critical: false },
  { url: `${RAW}/reports/prospective/web_forecasts_meta.json`, out: "forecasts_meta.json", critical: false },
  { url: `${RAW}/reports/prospective/forecast_scorecard_meta.json`, out: "forecast_scorecard.json", critical: false },
  { url: `${RAW}/reports/eda/eda_facts.json`, out: "eda_facts.json", critical: false },
  { url: `${RAW}/reports/eda/eda_report.pdf`, out: "eda_report.pdf", critical: false },
  // FE (feature engineering): census of the cleaning/FE master decisions + the
  // standalone report. The English report is a REAL translation (unlike the EDA
  // one, still Spanish-only) and ships under its own name.
  { url: `${RAW}/reports/fe/fe_facts.json`, out: "fe_facts.json", critical: false },
  { url: `${RAW}/reports/fe/fe_report.pdf`, out: "fe_report.pdf", critical: false },
  { url: `${RAW}/reports/fe/en/fe_report.pdf`, out: "fe_report_en.pdf", critical: false },
];
// EDA gallery figures (committed fallbacks in public/data/eda/, refreshed with
// every new bulletin by the data repo's Action — same non-critical contract).
// Each figure ships in four true renders (language × theme): light (gallery/),
// dark (gallery/dark/, charcoal surface from vp_model/palette.py's DARK theme),
// and their English counterparts (gallery/en/, gallery/en/dark/ — the /en/*
// pages used to serve PNGs with rasterized Spanish text).
const GALLERY = [
  "g01_panel", "g02_trayectorias", "g03_backlog", "g04_retros", "g05_brecha",
  "g06_pulso_fiscal", "g07_leadlag", "g08_congelados", "g09_estacionariedad",
  "g10_dv", "g11_completitud",
];
// FE gallery: same four-variant contract (language × theme), 7 figures.
const FE_GALLERY = [
  "f01_differencing", "f02_calendar", "f03_importance", "f04_gaps",
  "f05_regime", "f06_parser", "f07_pipeline",
];
const galleryPaths = []; // public/data-relative PNG paths (for the dims probe)
for (const [dir, names] of [["eda", GALLERY], ["fe", FE_GALLERY]]) {
  for (const g of names) {
    for (const sub of ["", "dark", "en", "en/dark"]) {
      const out = join(dir, ...sub.split("/").filter(Boolean), `${g}.png`);
      galleryPaths.push(out);
      FILES.push({
        url: `${RAW}/reports/${dir}/gallery/${sub ? `${sub}/` : ""}${g}.png`,
        out,
        critical: false,
      });
    }
  }
  await mkdir(join(OUT, dir, "dark"), { recursive: true });
  await mkdir(join(OUT, dir, "en", "dark"), { recursive: true });
}

const exists = async (p) => access(p).then(() => true).catch(() => false);

let fresh = 0;
for (const f of FILES) {
  const dest = join(OUT, f.out);
  try {
    // L5: cache-buster — raw.githubusercontent sits behind a ~5-min CDN and the
    // Netlify hook fires seconds after the data repo's push, so a build could
    // bake the PRE-push panel and stay a month stale until the next bulletin.
    // A unique query string forces a cache miss (the CDN keys on the full URL).
    const r = await fetch(`${f.url}?nocache=${Date.now()}`, { redirect: "follow" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = Buffer.from(await r.arrayBuffer());
    if (body.length < 32) throw new Error(`suspiciously small (${body.length}B)`);
    // audit L1: a 200-but-corrupt body must NOT overwrite the good committed
    // fallback — probe by content type before writing.
    if (dest.endsWith(".json")) JSON.parse(body.toString("utf8"));
    if (dest.endsWith(".png") && !(body[0] === 0x89 && body[1] === 0x50)) throw new Error("not a PNG");
    if (dest.endsWith(".pdf") && body.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
    await writeFile(dest, body);
    fresh++;
    console.log(`  ✓ ${f.out} ← data repo (${(body.length / 1024).toFixed(0)} kB)`);
  } catch (e) {
    if (await exists(dest)) {
      console.warn(`  ! ${f.out}: fetch failed (${e.message}) → keeping committed fallback`);
    } else if (f.critical) {
      console.error(`  ✗ ${f.out}: fetch failed and no fallback present — failing build`);
      process.exit(1);
    } else {
      console.warn(`  ! ${f.out}: fetch failed (${e.message}), no fallback — the browser drift baseline will cover forecasts`);
    }
  }
}
console.log(`fetch-data: ${fresh}/${FILES.length} refreshed from the data repo`);

// ── figure dimensions (audit: stop trusting hardcoded pixel dims) ───────────
// Probe every gallery PNG actually on disk (fresh fetch or committed fallback)
// and emit public/data/fig_dims.json — the galleries import it at build time so
// each of the four variants (language × theme) renders with its own MEASURED
// intrinsic size; the components' constants remain only as a fallback for
// files missing from this map. Width/height live in the PNG IHDR chunk, which
// always starts at byte 16 (two big-endian uint32s).
const dims = {};
for (const rel of galleryPaths) {
  try {
    const buf = await readFile(join(OUT, rel));
    if (!(buf[0] === 0x89 && buf[1] === 0x50) || buf.length < 24) continue;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w > 0 && h > 0) dims[rel.split("\\").join("/")] = { w, h };
  } catch {
    // missing file (fetch failed and no fallback) → the component fallback dims apply
  }
}
await writeFile(join(OUT, "fig_dims.json"), JSON.stringify(dims, null, 1) + "\n");
console.log(`fetch-data: fig_dims.json → ${Object.keys(dims).length} figures measured`);
