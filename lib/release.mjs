// Release-manifest consumption (B2, plan auditoría 2026-07-11): pure helpers shared by
// scripts/fetch-data.mjs and its tests. The data repo publishes a release manifest (B1,
// reports/release/release_manifest.json) listing every artifact of a publishable cut
// with SHA-256/size/criticality under a content-addressed release_id. The loader
// downloads EVERYTHING to staging, verifies each hash, and only then swaps into
// public/data — the site never ships a mix of two cuts. This module is IO-free:
// mapping, verification and the swap decision live here; fetch/write stay in the script.
import { createHash } from "node:crypto";

export const MANIFEST_PATH = "reports/release/release_manifest.json";
export const SUPPORTED_SCHEMA = 1;

// repo path → public/data out name. Unmapped artifacts (ledgers, governance markdown)
// are part of the release but not consumed into public/data — the RAG indexes those
// through its own pipeline.
const BASE_MAP = {
  "data/processed/visa_panel_long.csv": "visa_panel_long.csv",
  "data/processed/bulletins.json": "bulletins.json",
  "reports/prospective/web_forecasts.csv": "forecasts.csv",
  "reports/prospective/web_forecasts_meta.json": "forecasts_meta.json",
  "reports/prospective/forecast_scorecard_meta.json": "forecast_scorecard.json",
  "reports/eda/eda_facts.json": "eda_facts.json",
  "reports/eda/eda_report.pdf": "eda_report.pdf",
  "reports/eda/en/eda_report.pdf": "eda_report_en.pdf",
  "reports/fe/fe_facts.json": "fe_facts.json",
  "reports/fe/fe_report.pdf": "fe_report.pdf",
  "reports/fe/en/fe_report.pdf": "fe_report_en.pdf",
};
const GALLERY_RX = /^reports\/(eda|fe)\/gallery\/((?:en\/dark\/|en\/|dark\/)?)([\w-]+)\.png$/;
// B3: los contratos viajan en el release y se sirven en /data/contracts/ — el loader
// compara su hash contra la copia vendorizada (lib/contracts/) y trata la deriva como
// corte no consumible (el vendored es lo que ESTE loader sabe validar).
const CONTRACT_RX = /^vp_data\/contracts\/([\w.-]+\.json)$/;

export function outFor(repoPath) {
  if (BASE_MAP[repoPath]) return BASE_MAP[repoPath];
  const g = GALLERY_RX.exec(repoPath);
  if (g) return `${g[1]}/${g[2]}${g[3]}.png`;
  const c = CONTRACT_RX.exec(repoPath);
  return c ? `contracts/${c[1]}` : null;
}

export const isContract = (entry) => entry.out?.startsWith("contracts/");

// true si la copia vendorizada coincide byte a byte (por hash) con la publicada.
export function vendoredMatches(entry, vendoredBuffer) {
  if (!vendoredBuffer) return false;
  return createHash("sha256").update(vendoredBuffer).digest("hex") === entry.sha256;
}

// Validación de un payload contra su contrato vendorizado (B3, espejo del validador
// Python tools/check_contracts.py del repo de datos). Regresa true o la razón.
const JS_TYPE = {
  str: (v) => typeof v === "string",
  int: (v) => Number.isInteger(v),
  float: (v) => typeof v === "number",
  number: (v) => typeof v === "number",
  dict: (v) => !!v && typeof v === "object" && !Array.isArray(v),
  list: (v) => Array.isArray(v),
  bool: (v) => typeof v === "boolean",
};

export function validateArtifact(contract, buffer) {
  if (contract.kind === "csv") {
    const header = buffer.toString("utf8").split("\n", 1)[0].trim().split(",");
    const missing = contract.required_columns.filter((c) => !header.includes(c));
    return missing.length ? `columnas requeridas ausentes: ${missing.join(",")}` : true;
  }
  let data;
  try {
    data = JSON.parse(buffer.toString("utf8"));
  } catch (e) {
    return `JSON ilegible (${e.message})`;
  }
  for (const [key, t] of Object.entries(contract.required_keys ?? {})) {
    if (!(key in data)) return `llave requerida ausente: ${key}`;
    if (!JS_TYPE[t](data[key])) return `'${key}' debería ser ${t}`;
  }
  return true;
}

// Manifest artifacts the site build consumes, each annotated with its local out name.
export function consumedEntries(manifest) {
  return (manifest.artifacts ?? [])
    .map((e) => ({ ...e, out: outFor(e.path) }))
    .filter((e) => e.out);
}

// true when the downloaded bytes match the manifest entry; a reason string otherwise.
/**
 * @param {{ sha256: string, size: number }} entry
 * @param {Buffer} buffer
 * @returns {true | string}
 */
export function verifyEntry(entry, buffer) {
  if (buffer.length !== entry.size) return `size ${buffer.length} != ${entry.size}`;
  const got = createHash("sha256").update(buffer).digest("hex");
  return got === entry.sha256 ? true : "sha256 mismatch";
}

// Swap decision over the verification results (Map out → true | reason). Any failed
// critical/required entry vetoes the whole swap (the previous cut stays intact);
// failed optionals degrade loudly but never block.
/**
 * @param {Array<{ out: string, criticality: string }>} entries
 * @param {Map<string, true | string>} results
 * @returns {{ swap: boolean, status: "fresh" | "stale", reason?: string, missingOptional: string[] }}
 */
export function planSwap(entries, results) {
  const failedBlocking = [];
  const missingOptional = [];
  for (const e of entries) {
    const r = results.get(e.out);
    if (r === true) continue;
    const label = `${e.criticality}:${e.out} (${r ?? "not fetched"})`;
    (e.criticality === "optional" ? missingOptional : failedBlocking).push(label);
  }
  if (failedBlocking.length) {
    return {
      swap: false,
      status: "stale",
      reason: `blocking artifacts failed verification: ${failedBlocking.join("; ")}`,
      missingOptional,
    };
  }
  return { swap: true, status: "fresh", missingOptional };
}

// Shipped at /data/release-state.json so the deployed cut is inspectable:
// fresh (verified swap) · stale (previous cut kept) · incompatible (manifest schema
// ahead of this loader) · legacy (env-forced per-file fetch, unverified).
//
// Provenance rule (author audit 11-jul): release_id/panel_vintage/generated_at always
// describe the cut whose BYTES are served. On fresh that is the new manifest; on any
// non-fresh status it is the PREVIOUS state (the kept cut — typically the committed
// fallback's), and the refused manifest is recorded apart as rejected_release_id.
// Before this rule a stale build attributed old bytes to a release never installed.
/**
 * @param {{ status: string,
 *           manifest?: { release_id?: string, panel_vintage?: string, generated_at?: string } | null,
 *           previous?: { release_id?: string, panel_vintage?: string, generated_at?: string } | null,
 *           missingOptional?: string[], reason?: string | null, fetchedAt?: string | null }} opts
 */
export function releaseState({
  status,
  manifest = null,
  previous = null,
  missingOptional = [],
  reason = null,
  fetchedAt = null,
}) {
  const served = status === "fresh" ? manifest : previous;
  return {
    status,
    reason,
    release_id: served?.release_id ?? null,
    panel_vintage: served?.panel_vintage ?? null,
    generated_at: served?.generated_at ?? null,
    rejected_release_id: status === "fresh" ? null : (manifest?.release_id ?? null),
    fetched_at: fetchedAt ?? new Date().toISOString(),
    missing_optional: missingOptional,
  };
}

// Transactional swap (author audit 11-jul: the swap was N sequential renames — an
// exception mid-loop left a hybrid tree inside the failed build). Two phases with
// rollback: (A) every existing target moves aside to a backup dir, (B) staged files
// rename into place; ANY failure removes what was placed and restores every backup,
// so the previous cut survives whole and the caller reports stale. A hard kill
// (SIGKILL) can still interrupt mid-swap, but that fails the build and a failed
// Netlify build never deploys — deploy-level atomicity is what production sees.
// `fs` is injected ({ rename, mkdir, rm, exists }) so tests can wound phase B.
/**
 * @param {Array<{ out: string }>} entries
 * @param {Map<string, true | string>} results
 * @param {{ out: string, staging: string, backup: string, joinPath: (...p: string[]) => string,
 *           dirOf: (p: string) => string,
 *           fs: { rename: (a: string, b: string) => Promise<void>,
 *                 mkdir: (p: string) => Promise<void>,
 *                 rm: (p: string) => Promise<void>,
 *                 exists: (p: string) => Promise<boolean> } }} ctx
 * @returns {Promise<{ swapped: number, rolledBack: boolean, error?: string }>}
 */
export async function executeSwap(entries, results, { out, staging, backup, joinPath, dirOf, fs }) {
  const winners = entries.filter((e) => results.get(e.out) === true);
  const movedAside = [];
  const placed = [];
  try {
    await fs.rm(backup);
    for (const e of winners) {
      const dest = joinPath(out, e.out);
      if (await fs.exists(dest)) {
        const kept = joinPath(backup, e.out);
        await fs.mkdir(dirOf(kept));
        await fs.rename(dest, kept);
        movedAside.push(e.out);
      }
    }
    for (const e of winners) {
      const dest = joinPath(out, e.out);
      await fs.mkdir(dirOf(dest));
      await fs.rename(joinPath(staging, e.out), dest);
      placed.push(e.out);
    }
    await fs.rm(backup);
    return { swapped: placed.length, rolledBack: false };
  } catch (err) {
    for (const o of placed) await fs.rm(joinPath(out, o)).catch(() => {});
    for (const o of movedAside) {
      await fs.mkdir(dirOf(joinPath(out, o))).catch(() => {});
      await fs.rename(joinPath(backup, o), joinPath(out, o)).catch(() => {});
    }
    await fs.rm(backup).catch(() => {});
    return { swapped: 0, rolledBack: true, error: err instanceof Error ? err.message : String(err) };
  }
}
