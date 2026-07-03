// Pull the latest panel + production-model forecasts from the data repo at BUILD
// time, so every deploy reflects the current bulletin without a manual copy. The
// data repo's weekly Action regenerates these on a new bulletin and pings a
// Netlify build hook → this runs → the site ships fresh data.
//
// The committed files in public/data/ are the fallback: if GitHub raw hiccups,
// we keep whatever is already there (the panel is critical; forecasts optional).
import { writeFile, access, mkdir } from "node:fs/promises";
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
];
// EDA gallery figures (committed fallbacks in public/data/eda/, refreshed with
// every new bulletin by the data repo's Action — same non-critical contract).
const GALLERY = [
  "g01_panel", "g02_trayectorias", "g03_backlog", "g04_retros", "g05_brecha",
  "g06_pulso_fiscal", "g07_leadlag", "g08_congelados", "g09_estacionariedad",
  "g10_dv", "g11_completitud",
];
for (const g of GALLERY) {
  FILES.push({ url: `${RAW}/reports/eda/gallery/${g}.png`, out: join("eda", `${g}.png`), critical: false });
}
await mkdir(join(OUT, "eda"), { recursive: true });

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
