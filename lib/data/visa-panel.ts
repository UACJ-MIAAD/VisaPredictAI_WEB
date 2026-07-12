// Real historical panel loader. Source: /data/visa_panel_long.csv — the
// processed panel from the UACJ-MIAAD/VisaPredictAI repo (audit §9).
// NO fabrication: missing cells stay null and surface as honest empty states.
//
// AZ5 — parsing moved off the main thread: loadPanel() spawns a Web Worker
// (lib/data/panel-worker.ts) that fetches + parses + computes movement and
// posts the finished Panel back. The parsing itself lives in
// lib/data/panel-core.ts, shared with the inline fallback used when Workers
// are unavailable (SSR/tests/old browsers). Public API unchanged: same
// Promise<Panel> signature, same shared cache across all callers.

import { buildPanel, fetchPanelText, type Panel, type VisaPanelRow } from "./panel-core";

export type { Panel, VisaPanelRow };

// Pilot coverage + country labels now live in panel-core.mjs (single source of
// truth shared with the Netlify function — US I1); re-exported here so the many
// existing import sites keep working unchanged.
export { PILOT, COUNTRY_LABEL, countryLabel } from "./panel-core.mjs";

const loadInline = async (): Promise<Panel> => buildPanel(await fetchPanelText());

function loadViaWorker(): Promise<Panel> {
  return new Promise((resolve, reject) => {
    // NOTE: keep the `new Worker(new URL(...))` literal — the bundler
    // statically analyzes this exact pattern to emit the worker chunk.
    const worker = new Worker(new URL("./panel-worker.ts", import.meta.url));
    const done = () => worker.terminate();
    worker.onmessage = (
      ev: MessageEvent<{ ok: true; panel: Panel } | { ok: false; error: string }>,
    ) => {
      done();
      if (ev.data.ok) resolve(ev.data.panel);
      // ok:false can be a genuine fetch/parse failure (inline fails the same
      // way, cheap retry) OR a worker-bundle-specific defect — the 2026-07-12
      // incident shipped a worker whose chunk lost fetchPanelText while the
      // inline path was fine. Always try inline before giving up.
      else loadInline().then(resolve, reject);
    };
    worker.onerror = () => {
      // worker INFRA failed (script load, CSP...) — the data may still be
      // fine, so fall back to parsing on the main thread.
      done();
      loadInline().then(resolve, reject);
    };
    // The worker only starts on an incoming message — without this kick,
    // loadPanel() hangs forever (caught by the post-plan audit, live in prod).
    worker.postMessage(null);
  });
}

let cache: Promise<Panel> | null = null;

export function loadPanel(): Promise<Panel> {
  if (cache) return cache;
  const canWorker = typeof window !== "undefined" && typeof Worker !== "undefined";
  cache = (canWorker ? loadViaWorker() : loadInline()).catch((e) => {
    cache = null; // allow retry
    throw e;
  });
  return cache;
}

// El parseo guarda block en ES ("empleo"/"familia"); traducir SOLO al mostrar.
const BLOCK_EN: Record<string, string> = { empleo: "employment", familia: "family" };
export const blockLabel = (b: string, lang?: string) => (lang === "en" ? BLOCK_EN[b] || b : b);

// Single source of truth for status/movement colors (was duplicated ×3).
export function statusColor(s: string): string {
  return s === "F"
    ? "var(--color-success)"
    : s === "U"
      ? "var(--color-danger)"
      : s === "C"
        ? "var(--color-accent)"
        : "var(--color-muted)";
}
export function movementColor(n: number): string {
  return n > 0
    ? "var(--color-success)"
    : n < 0
      ? "var(--color-danger)"
      : "var(--color-muted)";
}
