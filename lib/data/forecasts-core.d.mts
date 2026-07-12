// Type surface for forecasts-core.mjs (plain ESM so the Netlify chat function
// can bundle it — see the header of forecasts-core.mjs). Kept in sync BY HAND
// with the .mjs exports; forecasts.ts re-exports this surface.

export type ForecastPoint = { date: string; days: number; lo80: number; hi80: number; lo95: number; hi95: number };
export type SeriesMeta = { models: string[]; mase: number; last_month: string };
export type HorizonScore = { mae_days: number; mase: number; cov95: number };
export type Scorecard = {
  n_scored: number;
  overall: { mae_days: number; mase: number; cov80: number; cov95: number };
  by_horizon: Record<string, HorizonScore>;
  // present in the source JSON; optional here so older fixtures still type-check
  caveat?: string;
  n_vintages_effective?: number;
  band80_calibration?: { cov80_heldout?: number };
};
export type ForecastStore = {
  method: Record<string, string>; // table -> human method description
  series: Map<string, ForecastPoint[]>; // "country|category|table" -> future points
  meta: Map<string, SeriesMeta>;
  scorecard: Scorecard | null; // prospective scorecard (leakage-free backfill: origin-truncated vs realized)
  horizonMonths: number; // forecast horizon, derived from the pipeline (0 when no forecasts shipped)
  status: "ok" | "production_unavailable";
  reason?: string; // human-readable cause when status is production_unavailable
};

export declare const FORECAST_PATHS: { csv: string; meta: string; scorecard: string };

export declare function unavailableStore(reason: string): ForecastStore;
export declare function parseForecastStore(
  csv: string,
  metaJson: { method?: Record<string, string>; series?: Record<string, SeriesMeta>; horizon_months?: number } | null | undefined,
  scorecardJson: Scorecard | null | undefined,
): ForecastStore;

export declare function forecastFor(
  store: ForecastStore | null, country: string, category: string, table: string,
): ForecastPoint[] | null;
export declare function forecastMetaFor(
  store: ForecastStore | null, country: string, category: string, table: string,
): SeriesMeta | null;
