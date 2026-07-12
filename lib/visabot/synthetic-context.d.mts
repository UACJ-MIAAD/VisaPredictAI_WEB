// Type surface for synthetic-context.mjs (plain ESM so the Netlify chat
// function bundles it — see the .mjs header). Kept in sync BY HAND.

import type { Panel } from "../data/panel-core.mjs";
import type { ForecastStore } from "../data/forecasts-core.mjs";
import type { Lang } from "./analytics";

export declare const MAX_SYNTH: number;

export declare const SYNTH_ERR: {
  descriptorRequired: "synthetic_descriptor_required";
  releaseStale: "release_stale";
  unknownSeries: "unknown_series";
  unknownMonth: "unknown_month";
  unavailable: "synthetic_unavailable";
  rebuildFailed: "synthetic_rebuild_failed";
};

export declare const SYNTH_SOURCES: {
  panel: { es: string; en: string };
  live: { es: string; en: string };
};

// Normalized (whitelisted) descriptor as validated server-side.
export type ValidatedDescriptor =
  | { kind: "month_table"; month: string; table: string }
  | { kind: "bulletin_diff"; monthA: string; monthB: string; table: string }
  | { kind: "forecast_note"; country: string; category: string; table: string }
  | { kind: "chart_note"; chart: string; country?: string; category?: string; table?: string; block?: string };

export declare function validateDescriptors(
  raw: unknown,
): { descriptors: ValidatedDescriptor[]; error?: undefined } | { error: string; descriptors?: undefined };

export type SyntheticData = { panel: Panel; store: ForecastStore };

export declare function resetSyntheticData(): void;
export declare function loadSyntheticData(opts: {
  base: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<SyntheticData>;

export type RebuiltSource = { n: number; title: string; source: string; text: string };
export declare function buildSyntheticContext(
  descriptors: ValidatedDescriptor[],
  data: SyntheticData,
  lang: Lang,
): { sources: RebuiltSource[]; error?: undefined } | { error: string; sources?: undefined };
