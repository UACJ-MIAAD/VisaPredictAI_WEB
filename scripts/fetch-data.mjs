// Pull the data-repo cut for this deploy. B2 (plan auditoría 2026-07-11): the loader
// consumes the data repo's RELEASE MANIFEST (B1) — every artifact is downloaded to a
// staging dir, verified against its SHA-256/size, and only when every critical and
// required artifact of the SAME release_id verifies does the set swap into
// public/data/. The site never bakes a mix of two cuts: any blocking failure keeps the
// previous cut whole (status "stale"). If the manifest is unavailable the committed
// fallback cut is served WHOLE (auditor round 2: the automatic per-file fetch could bake
// an unverified hybrid); the per-file path survives ONLY as the explicit operator
// rollback (FETCH_LEGACY=1, status "legacy", identity null — unverified by design).
// /data/release-state.json ships the outcome (fresh | stale | incompatible | legacy).
//
// The committed files in public/data/ remain the last-resort fallback: if GitHub raw
// hiccups entirely, the build keeps whatever is already there (panel critical).
import { writeFile, readFile, readdir, access, mkdir, stat, rename, rm } from "node:fs/promises";
import { join, dirname } from "node:path";

import { DATA_REPO_RAW as RAW } from "../lib/repo.mjs";
import {
  MANIFEST_PATH,
  SUPPORTED_SCHEMA,
  consumedEntries,
  executeDisposition,
  executeSwap,
  isContract,
  planSwap,
  releaseState,
  swapDisposition,
  validateArtifact,
  vendoredMatches,
  verifyEntry,
} from "../lib/release.mjs";

const OUT = join(process.cwd(), "public", "data");
const STAGING = join(process.cwd(), ".fetch-staging");
const BACKUP = join(process.cwd(), ".fetch-backup");

// Provenance (author audit 11-jul): whatever state shipped with the checkout describes
// the bytes currently in public/data (the committed fallback cut, or the last verified
// swap in a dev tree). Any non-fresh outcome keeps those bytes -- and must keep their
// identity too, with the refused manifest recorded apart as rejected_release_id.
const PREVIOUS_STATE = await readFile(join(OUT, "release-state.json"), "utf8")
  .then((t) => JSON.parse(t))
  .catch(() => null);
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

// L5: cache-buster — raw.githubusercontent sits behind a ~5-min CDN and the
// Netlify hook fires seconds after the data repo's push, so a build could
// bake the PRE-push cut and stay a month stale until the next bulletin.
// A unique query string forces a cache miss (the CDN keys on the full URL).
async function fetchBuf(url) {
  const r = await fetch(`${url}?nocache=${Date.now()}`, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Legacy path (pre-B2 behavior, kept verbatim): per-file fetch with content probes
// over committed fallbacks. ONLY reachable via FETCH_LEGACY=1 (explicit operator
// rollback) since round 2 of the author audit — automatic use could bake an
// unverified hybrid. Unverified against any release; state carries null identity.
async function legacyFetch() {
  let fresh = 0;
  for (const f of FILES) {
    const dest = join(OUT, f.out);
    try {
      const body = await fetchBuf(f.url);
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
  console.log(`fetch-data: ${fresh}/${FILES.length} refreshed from the data repo (legacy path)`);
  return fresh;
}

// B3: contratos vendorizados (lib/contracts/*.json), indexados por artifact path —
// validan los payloads descargados y detectan deriva vendored-vs-publicado.
async function loadVendoredContracts() {
  const dir = join(process.cwd(), "lib", "contracts");
  const byArtifact = new Map();
  const byName = new Map();
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith(".json")) continue;
    const buf = await readFile(join(dir, f));
    byArtifact.set(JSON.parse(buf.toString("utf8")).artifact, JSON.parse(buf.toString("utf8")));
    byName.set(f, buf);
  }
  return { byArtifact, byName };
}

// Manifest path: staging → verify everything → atomic swap (or keep the previous cut).
async function manifestFetch(manifest) {
  const entries = consumedEntries(manifest);
  const vendored = await loadVendoredContracts();
  await rm(STAGING, { recursive: true, force: true });
  await mkdir(STAGING, { recursive: true });
  const results = new Map();
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let e = queue.shift(); e; e = queue.shift()) {
        try {
          const body = await fetchBuf(`${RAW}/${e.path}`);
          const ok = verifyEntry(e, body);
          if (ok !== true) throw new Error(ok);
          // B3a — deriva de contrato: el publicado debe SER el vendorizado (por hash);
          // un contrato nuevo que este loader no conoce = corte no consumible.
          if (isContract(e) && !vendoredMatches(e, vendored.byName.get(e.out.slice("contracts/".length)))) {
            throw new Error("contract drift vs vendored (actualizar lib/contracts/)");
          }
          // B3b — validación de payload contra el contrato vendorizado del artefacto.
          const contract = vendored.byArtifact.get(e.path);
          if (contract) {
            const valid = validateArtifact(contract, body);
            if (valid !== true) throw new Error(`contrato violado: ${valid}`);
          }
          const staged = join(STAGING, e.out);
          await mkdir(dirname(staged), { recursive: true });
          await writeFile(staged, body);
          results.set(e.out, true);
        } catch (err) {
          results.set(e.out, err.message);
        }
      }
    }),
  );
  const plan = planSwap(entries, results);
  if (!plan.swap) {
    console.warn(`fetch-data: NO swap — ${plan.reason}; the previous cut stays whole`);
    await rm(STAGING, { recursive: true, force: true });
    return releaseState({
      status: "stale",
      manifest,
      previous: PREVIOUS_STATE,
      reason: plan.reason,
      missingOptional: plan.missingOptional,
    });
  }
  // AZ3a bookkeeping BEFORE the swap: compare staged bytes against the current cut
  // while both still exist (the transactional swap moves the old files aside).
  for (const e of entries) {
    if (results.get(e.out) !== true || !e.out.endsWith(".png")) continue;
    const prev = await readFile(join(OUT, e.out)).catch(() => null);
    const next = await readFile(join(STAGING, e.out));
    if (!prev || !prev.equals(next)) pngChanged.add(e.out);
  }
  const swap = await executeSwap(entries, results, {
    out: OUT,
    staging: STAGING,
    backup: BACKUP,
    joinPath: join,
    dirOf: dirname,
    fs: {
      rename,
      mkdir: (p) => mkdir(p, { recursive: true }),
      rm: (p) => rm(p, { recursive: true, force: true }),
      exists,
    },
  });
  await rm(STAGING, { recursive: true, force: true });
  const disposition = swapDisposition(swap);
  // Rondas 3-4 audit: decision (swapDisposition) Y efecto (executeDisposition: error +
  // exit(1)) viven en release.mjs bajo test; aqui solo se enlazan console.error y
  // process.exit. Un build muerto es el no-deploy garantizado de Netlify.
  executeDisposition(disposition, { backup: BACKUP, error: console.error, exit: process.exit });
  if (disposition.kind === "stale") {
    console.error(`fetch-data: swap FAILED mid-flight (${swap.error}) — rolled back; the previous cut stays whole`);
    return releaseState({
      status: "stale",
      manifest,
      previous: PREVIOUS_STATE,
      reason: disposition.reason,
      missingOptional: plan.missingOptional,
    });
  }
  for (const m of plan.missingOptional) console.warn(`  ! optional degraded: ${m}`);
  console.log(`fetch-data: release ${manifest.release_id} verified → transactional swap (${swap.swapped} files)`);
  return releaseState({ status: "fresh", manifest, missingOptional: plan.missingOptional });
}

let state;
if (process.env.FETCH_OFFLINE === "1") {
  // G1: build de CI sin red — los fallbacks commiteados en public/data SON la release
  // fixture (inmutables al SHA del checkout). No se fetchea nada; dims y variantes de
  // imagen se derivan de lo que hay en disco.
  console.log("fetch-data: FETCH_OFFLINE=1 — CI fixture build sobre los fallbacks commiteados (sin red)");
  state = releaseState({ status: "stale", previous: PREVIOUS_STATE, reason: "FETCH_OFFLINE=1 (CI fixture build: committed fallbacks, no network)" });
} else if (process.env.FETCH_LEGACY === "1") {
  await legacyFetch();
  state = releaseState({ status: "legacy", reason: "FETCH_LEGACY=1 (forced rollback to per-file fetch)" });  // legacy bytes are per-file/unverified: no release identity to inherit
} else {
  let manifest = null;
  try {
    manifest = JSON.parse((await fetchBuf(`${RAW}/${MANIFEST_PATH}`)).toString("utf8"));
  } catch (e) {
    console.warn(`fetch-data: release manifest unavailable (${e.message}) → committed fallback cut kept whole`);
  }
  if (manifest && manifest.schema_version !== SUPPORTED_SCHEMA) {
    // A manifest from the future: this loader cannot verify it. Keep the previous
    // cut whole and say so — upgrading the loader is the fix, not guessing.
    console.error(
      `fetch-data: manifest schema_version ${manifest.schema_version} != supported ${SUPPORTED_SCHEMA} — keeping previous cut`,
    );
    state = releaseState({
      status: "incompatible",
      manifest,
      previous: PREVIOUS_STATE,
      reason: `manifest schema_version ${manifest.schema_version}, loader supports ${SUPPORTED_SCHEMA}`,
    });
  } else if (manifest) {
    state = await manifestFetch(manifest);
  } else {
    // 2a ronda audit 12-jul (CRITICO): aqui corria legacyFetch() automatico — una descarga
    // parcial por-archivo mezclaba bytes nuevos con fallbacks (hibrido SIN verificar) y el
    // build VERDE lo deployaba atribuido a la identidad del corte previo. Sin manifiesto,
    // el corte commiteado se sirve ENTERO: coherente, atribuible, un mes stale a lo sumo.
    // El fetch por-archivo sobrevive SOLO como rollback explicito (FETCH_LEGACY=1).
    console.warn("fetch-data: release manifest unavailable — serving the committed fallback cut WHOLE (no unverified per-file fetch)");
    state = releaseState({ status: "stale", previous: PREVIOUS_STATE, reason: "manifest unavailable — committed fallback cut kept whole" });
  }
}

// Last-resort guard (unchanged contract): the panel must exist on disk — verified
// swap, previous cut or committed fallback — or the site cannot build.
if (!(await exists(join(OUT, "visa_panel_long.csv")))) {
  console.error("fetch-data: panel missing and no fallback present — failing build");
  process.exit(1);
}
await writeFile(join(OUT, "release-state.json"), JSON.stringify(state, null, 2) + "\n");
console.log(`fetch-data: release-state → ${state.status}${state.release_id ? ` (${state.release_id})` : ""}`);

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
