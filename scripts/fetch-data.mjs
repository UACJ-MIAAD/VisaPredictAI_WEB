// Pull the latest panel + production-model forecasts from the data repo at BUILD
// time, so every deploy reflects the current bulletin without a manual copy. The
// data repo's weekly Action regenerates these on a new bulletin and pings a
// Netlify build hook → this runs → the site ships fresh data.
//
// The committed files in public/data/ are the fallback: if GitHub raw hiccups,
// we keep whatever is already there (the panel is critical; forecasts optional).
import { writeFile, readFile, access, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { DATA_REPO_RAW as RAW } from "../lib/repo.mjs";
const OUT = join(process.cwd(), "public", "data");
const FILES = [
  { url: `${RAW}/data/processed/visa_panel_long.csv`, out: "visa_panel_long.csv", critical: true },
  // AZ8b — the live-bulletins feed, mirrored at build time so the Boletines
  // section has a same-origin fallback when the remote raw host is blocked.
  { url: `${RAW}/data/processed/bulletins.json`, out: "bulletins.json", critical: false },
  { url: `${RAW}/reports/prospective/web_forecasts.csv`, out: "forecasts.csv", critical: false },
  { url: `${RAW}/reports/prospective/web_forecasts_meta.json`, out: "forecasts_meta.json", critical: false },
  { url: `${RAW}/reports/prospective/forecast_scorecard_meta.json`, out: "forecast_scorecard.json", critical: false },
  { url: `${RAW}/reports/eda/eda_facts.json`, out: "eda_facts.json", critical: false },
  { url: `${RAW}/reports/eda/eda_report.pdf`, out: "eda_report.pdf", critical: false },
  { url: `${RAW}/reports/eda/en/eda_report.pdf`, out: "eda_report_en.pdf", critical: false },
  // FE (feature engineering): census of the cleaning/FE master decisions + the
  // standalone report. Both the EDA and FE reports ship a real EN translation
  // (reports/*/en/), served under their own *_en.pdf names.
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

// AZ3a — track which gallery PNGs actually changed bytes this run, so the
// AVIF/WebP derivation below only re-encodes what moved (or what has no
// variants yet — first run over the committed fallbacks).
const pngChanged = new Set();

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
    if (dest.endsWith(".png")) {
      const prev = await readFile(dest).catch(() => null);
      if (!prev || !prev.equals(body)) pngChanged.add(f.out);
    }
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

// ── AZ3a: modern image variants (AVIF + WebP) next to every gallery PNG ─────
// Naming contract for the <picture> phase: for each `<name>.png` there is a
// `<name>.avif` and a `<name>.webp` IN THE SAME DIRECTORY (all four
// language × theme variants included). Variants of the committed fallbacks are
// committed too; fresh fetches re-encode only the PNGs whose bytes changed.
// sharp is a devDependency of the build — if it is ever unavailable the build
// still succeeds and the PNGs simply ship alone.
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("fetch-data: sharp unavailable — skipping AVIF/WebP variants");
}
if (sharp) {
  const jobs = [];
  for (const rel of galleryPaths) {
    const png = join(OUT, rel);
    if (!(await exists(png))) continue; // fetch failed and no fallback
    const avif = png.replace(/\.png$/, ".avif");
    const webp = png.replace(/\.png$/, ".webp");
    const changed = pngChanged.has(rel);
    const missing = !(await exists(avif)) || !(await exists(webp));
    if (!changed && !missing) continue;
    jobs.push(async () => {
      const src = sharp(png);
      const pngBytes = (await stat(png)).size;
      await Promise.all([
        src.clone().avif({ quality: 55, effort: 4 }).toFile(avif),
        // Pick the smaller WebP: lossy q78 wins on photographic content, but on
        // flat figures/screenshots it can exceed the PNG (g01: 245 KB > 243 KB)
        // while lossless crushes them (70 KB). Deleting the WebP is not an option
        // — the <picture> emits a webp <source> unconditionally, so a 404 breaks
        // that image. So we always ship a WebP, just the best one (audit B4).
        (async () => {
          const lossy = await src.clone().webp({ quality: 78 }).toBuffer();
          const best =
            lossy.length < pngBytes
              ? lossy
              : [lossy, await src.clone().webp({ lossless: true }).toBuffer()].reduce((a, b) =>
                  b.length < a.length ? b : a,
                );
          await writeFile(webp, best);
        })(),
      ]);
    });
  }
  // small pool — AVIF encoding is CPU-bound; 4-wide keeps CI times sane.
  let converted = 0;
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await job();
        converted++;
      }
    }),
  );
  console.log(
    `fetch-data: image variants → ${converted} PNGs (re)encoded to AVIF+WebP, ` +
      `${galleryPaths.length - converted} already current`,
  );
}
