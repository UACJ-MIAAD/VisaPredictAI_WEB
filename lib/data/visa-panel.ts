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

// Pilot coverage (single source of truth — analytics, explorer and hero derive from it).
export const PILOT = ["mexico", "india", "china", "philippines", "all_chargeability"];

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
      else reject(new Error(ev.data.error)); // fetch/parse failed — inline would fail the same way
    };
    worker.onerror = () => {
      // worker INFRA failed (script load, CSP...) — the data may still be
      // fine, so fall back to parsing on the main thread.
      done();
      loadInline().then(resolve, reject);
    };
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

export const COUNTRY_LABEL: Record<string, string> = {
  mexico: "México",
  india: "India",
  china: "China",
  philippines: "Filipinas",
  all_chargeability: "All Chargeability",
  row: "Resto del mundo",
};
const COUNTRY_LABEL_EN: Record<string, string> = {
  mexico: "Mexico",
  india: "India",
  china: "China",
  philippines: "Philippines",
  all_chargeability: "All Chargeability",
  row: "Rest of the world",
};
// G3: lang opcional para no tocar a los llamadores ES; la versión EN traduce al render.
export const countryLabel = (c: string, lang?: string) =>
  (lang === "en" ? COUNTRY_LABEL_EN[c] : COUNTRY_LABEL[c]) || c;
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
