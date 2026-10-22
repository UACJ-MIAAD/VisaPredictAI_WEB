// Build-time numeric bindings from the SAME verified cut as the live sections.
// Unknown bindings and inconsistent facts stop the build; no stale literal fallback.
export function censusValues(facts, eda) {
  const keys = ["n_obs", "n_obs_F", "n_months", "n_retro_events", "n_series_structural"];
  for (const key of keys) {
    if (!Number.isSafeInteger(facts?.[key]) || facts[key] < 0) throw new Error(`census: invalid ${key}`);
  }
  if (!facts.n_obs || !facts.n_months) throw new Error("census: empty panel");
  for (const key of ["n_obs", "n_obs_F", "n_months"]) {
    if (facts[key] !== eda?.panel?.[key]) throw new Error(`census: inconsistent ${key}`);
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(facts.date_last) || facts.date_last !== eda?.panel?.date_last) throw new Error("census: invalid vintage");
  const groups = { family_FAD: 0, family_DFF: 0, employment_FAD: 0, employment_DFF: 0 };
  const seen = new Set();
  let dff = 0;
  for (const row of eda.series ?? []) {
    const group = `${row.block}_${row.table}`;
    const identity = JSON.stringify([row.country, row.block, row.category, row.table]);
    if (!(group in groups) || seen.has(identity) || !Number.isSafeInteger(row.n_total) || row.n_total < 0 || row.n_total > facts.n_months) throw new Error("census: invalid series");
    seen.add(identity);
    groups[group] += row.n_total;
    if (row.table === "DFF") dff = Math.max(dff, row.n_total);
  }
  if (seen.size !== facts.n_series_structural || Object.values(groups).reduce((a, b) => a + b, 0) !== facts.n_obs) throw new Error("census: series census differs from panel");
  const regime = eda.regime;
  if (!["F", "C", "U", "UNK"].every((key) => Number.isSafeInteger(regime?.[key]) && regime[key] >= 0) || Object.values(regime).reduce((a, b) => a + b, 0) !== facts.n_obs || regime.F !== facts.n_obs_F) throw new Error("census: invalid regimes");
  return { n_obs: facts.n_obs, n_obs_F: facts.n_obs_F, n_months: facts.n_months, n_retro_events: facts.n_retro_events, date_last: facts.date_last, regime_C: regime.C, dff_months: dff, ...groups };
}

export function renderCensus(source, values) {
  const result = source.replace(/\{\{census:([A-Za-z_]+)(:comma)?\}\}/g, (_, key, comma) => {
    if (!Object.hasOwn(values, key)) throw new Error(`census: unknown binding ${key}`);
    const value = values[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return comma ? value.toLocaleString("en-US") : String(value);
    if (key === "date_last" && !comma && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
    throw new Error(`census: invalid binding ${key}`);
  });
  if (result.includes("{{census:")) throw new Error("census: malformed binding");
  return result;
}
