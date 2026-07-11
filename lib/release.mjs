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

export function outFor(repoPath) {
  if (BASE_MAP[repoPath]) return BASE_MAP[repoPath];
  const m = GALLERY_RX.exec(repoPath);
  return m ? `${m[1]}/${m[2]}${m[3]}.png` : null;
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
/**
 * @param {{ status: string,
 *           manifest?: { release_id?: string, panel_vintage?: string, generated_at?: string } | null,
 *           missingOptional?: string[], reason?: string | null, fetchedAt?: string | null }} opts
 */
export function releaseState({ status, manifest = null, missingOptional = [], reason = null, fetchedAt = null }) {
  return {
    status,
    reason,
    release_id: manifest?.release_id ?? null,
    panel_vintage: manifest?.panel_vintage ?? null,
    generated_at: manifest?.generated_at ?? null,
    fetched_at: fetchedAt ?? new Date().toISOString(),
    missing_optional: missingOptional,
  };
}
