// Shared inline CSV fixture for the unit suite. Mirrors the real header of
// visa_panel_long.csv (see lib/data/panel-core.ts parseCsv) and covers:
// advance, retrogression, C/U/UNK regimes, a legitimate "0" in
// days_since_base, empty cells, and months spread out enough for parseMonth.
export const PANEL_HEADER =
  "country,block,category,table,bulletin_date,status,priority_date,days_since_base";

export const PANEL_CSV =
  [
    PANEL_HEADER,
    // mexico F1 FAD: +31 days, then a -14 retrogression
    "mexico,family,F1,FAD,2024-07-01,F,2001-05-15,9631",
    "mexico,family,F1,FAD,2024-08-01,F,2001-06-15,9662",
    "mexico,family,F1,FAD,2024-09-01,F,2001-06-01,9648",
    // india EB2: Current (no date, no days)
    "india,employment,EB2,FAD,2024-07-01,C,,",
    // china EB5 variants (longest-code-wins entity detection)
    "china,employment,EB5,FAD,2024-07-01,F,2015-12-01,14944",
    "china,employment,EB5_RURAL,DFF,2024-07-01,C,,",
    // philippines F2A: U regime, a legit 0 days_since_base, an UNK row
    "philippines,family,F2A,FAD,2020-03-01,U,,",
    "philippines,family,F2A,FAD,2018-03-01,F,1975-01-01,0",
    "philippines,family,F2A,FAD,2010-07-01,UNK,,",
  ].join("\n") + "\n";

// Epoch (days since 1970) of the project's t0 = 1975-01-01, so synthetic
// priority dates stay consistent with their days_since_base.
export const T0_EPOCH_DAYS = Date.UTC(1975, 0, 1) / 86400000;

export const isoOfDaysSinceBase = (d: number): string =>
  new Date((T0_EPOCH_DAYS + d) * 86400000).toISOString().slice(0, 10);

// A single series with `n` monthly F observations advancing `step` days/month
// (≥8 rows unlocks buildForecast's drift fallback).
export function linearSeriesCsv(n: number, step = 30): string {
  const lines = [PANEL_HEADER];
  let days = 9000;
  for (let i = 0; i < n; i++) {
    const month = `2023-${String(i + 1).padStart(2, "0")}-01`;
    days += step;
    lines.push(`mexico,family,F4,FAD,${month},F,${isoOfDaysSinceBase(days)},${days}`);
  }
  return lines.join("\n") + "\n";
}
