// Pull the latest panel + production-model forecasts from the data repo at BUILD
// time, so every deploy reflects the current bulletin without a manual copy. The
// data repo's weekly Action regenerates these on a new bulletin and pings a
// Netlify build hook → this runs → the site ships fresh data.
//
// The committed files in public/data/ are the fallback: if GitHub raw hiccups,
// we keep whatever is already there (the panel is critical; forecasts optional).
import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const RAW = "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main";
const OUT = join(process.cwd(), "public", "data");
const FILES = [
  { url: `${RAW}/data/processed/visa_panel_long.csv`, out: "visa_panel_long.csv", critical: true },
  { url: `${RAW}/reports/web_forecasts.csv`, out: "forecasts.csv", critical: false },
  { url: `${RAW}/reports/web_forecasts_meta.json`, out: "forecasts_meta.json", critical: false },
];

const exists = async (p) => access(p).then(() => true).catch(() => false);

let fresh = 0;
for (const f of FILES) {
  const dest = join(OUT, f.out);
  try {
    const r = await fetch(f.url, { redirect: "follow" });
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
