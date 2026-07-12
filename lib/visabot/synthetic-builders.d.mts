// Type surface for synthetic-builders.mjs (implementation is plain ESM so the
// Netlify chat function can bundle it — see the .mjs header). Type-only import
// cycle with analytics.ts is intentional and safe (analytics.ts re-exports this
// surface and owns the ChartSpec union).

import type { Panel } from "../data/panel-core.mjs";
import type { ForecastStore } from "../data/forecasts-core.mjs";
import type { ChartSpec, Lang, PanelIndex } from "./analytics";

export declare const FAM: string[];
export declare const EMP: string[];
export declare const CAT_ORDER_FULL: string[];

export declare const monthDays: (m: string) => number;
export declare const isoDays: (d: string) => number;
export declare const pdYear: (d: string) => number;
export declare const nextMonth: (m: string) => string;
export declare const epochToYear: (e: number) => number;
export declare const epochToDate: (e: number) => string;

export type ChartTitleKind =
  | "line" | "compare" | "movement" | "status" | "multiline" | "heatmap" | "radar" | "forecast";
// Returns null only for an unknown kind (unreachable with the typed union —
// the server module passes untyped descriptor kinds and null-checks itself).
export declare function chartTitle(
  kind: ChartTitleKind,
  p: { country?: string | null; category?: string | null; table?: string | null; block?: string | null },
  lang: Lang,
): string;
export declare function genericChartNote(title: string, lang: Lang): string;

export declare const bandOf: (b: [number, number] | null | undefined) => [number, number];

export type DriftFit = { slope: number; sigma: number; last: number };
export declare function fitDrift(ys: number[]): DriftFit;
export declare function driftBands(
  fit: DriftFit, h: number,
): { point: number; lo80: number; hi80: number; lo95: number; hi95: number };

export declare function buildForecast(
  panel: Panel, country: string, category: string, table: string, lang: Lang,
  horizon?: number, window?: number, forecasts?: ForecastStore | null, index?: PanelIndex,
): ChartSpec | null;
export declare function forecastText(spec: Extract<ChartSpec, { kind: "forecast" }>, lang: Lang): string;

export declare const MONTHS_ES: string[];
export declare const MONTHS_EN: string[];
export declare const monthLabel: (m: string, lang: Lang) => string;

export declare function buildMonthTable(panel: Panel, month: string, tableType: string, lang: Lang): ChartSpec | null;
export declare function monthTableText(spec: Extract<ChartSpec, { kind: "table" }>, lang: Lang): string;

export declare function buildBulletinDiff(panel: Panel, monthA: string, monthB: string, tableType: string, lang: Lang): ChartSpec | null;
export declare function bulletinDiffText(spec: Extract<ChartSpec, { kind: "bulletinDiff" }>, lang: Lang): string;
