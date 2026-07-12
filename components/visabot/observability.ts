// US I5 — pure client-side observability helpers for the VisaBot chat.
// Privacy by construction: nothing in this module ever RECEIVES the user's
// query — the answer-event props are built from fixed-key metrics only, and
// durations are bucketed so Plausible aggregates stay low-cardinality.
// See docs/PRIVACY_RAG.md for the full record of what is (not) collected.
import type { Lang } from "./types";
import type { Surface } from "./use-visabot-chat";

// Substrings of the SERVER templates in netlify/functions/chat.mjs
// (guardText / truncationNote). Duplicated here because the function module
// (node:crypto + JSON import) cannot enter the client bundle — the pairing is
// CROSS-PINNED in tests/observability.test.ts, so a wording change over there
// breaks the suite instead of silently blinding these detectors.
export const GUARD_MARKERS = {
  es: "No escribo ni muestro código fuente",
  en: "I don't write or show source code",
} as const;

export const TRUNCATION_MARKERS = {
  es: "Respuesta incompleta: se agotó el tiempo de generación.",
  en: "Incomplete answer: generation timed out.",
} as const;

/** Did the server's code guard cut this answer with its refusal? */
export function isGuardRefusal(text: string): boolean {
  return text.includes(GUARD_MARKERS.es) || text.includes(GUARD_MARKERS.en);
}

/** Was this answer cut by a server timeout (idle/total) — marked incomplete? */
export function isTruncated(text: string): boolean {
  return text.includes(TRUNCATION_MARKERS.es) || text.includes(TRUNCATION_MARKERS.en);
}

/** Bucketize a duration for analytics (aggregate, low-cardinality — no raw ms). */
export function timeBucket(ms: number): string {
  if (ms < 500) return "<0.5s";
  if (ms < 1000) return "0.5-1s";
  if (ms < 2000) return "1-2s";
  if (ms < 5000) return "2-5s";
  if (ms < 15000) return "5-15s";
  if (ms < 30000) return "15-30s";
  return ">30s";
}

export type AnswerMetrics = {
  lang: Lang;
  surface: Surface;
  /** retrieval mode actually available for this turn */
  mode: "bm25" | "dense";
  /** number of sources that grounded the answer (server list; local for extractive) */
  nSources: number;
  extractive: boolean;
  guard: boolean;
  truncated: boolean;
  ttftMs: number;
  totalMs: number;
};

// Fixed-key props for the "VisaBot Answer" event. The user's query is not even
// a parameter of this function — it CANNOT leak into analytics through here.
export function answerEventProps(m: AnswerMetrics): Record<string, string | number | boolean> {
  return {
    lang: m.lang,
    surface: m.surface,
    mode: m.mode,
    sources: m.nSources,
    no_sources: m.nSources === 0, // abstention proxy: answered without any grounding source
    extractive: m.extractive,
    guard: m.guard,
    truncated: m.truncated,
    ttft: timeBucket(m.ttftMs),
    total: timeBucket(m.totalMs),
  };
}
