// derive() turns eda_facts.json into ~25 gallery caption values — the most
// regla-#0-critical logic on the site (a wrong number ships as a confident
// caption). It lived inside a client component and had no test; now it is a
// pure lib function. Invariants are checked against the REAL committed JSON
// (relationships, not frozen values that change each bulletin) plus synthetic
// fixtures for the anti-"0 de 74" guards and label formatting.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { derive } from "@/lib/data/eda-derive";
import type { EdaFacts } from "@/lib/data/eda";

const real: EdaFacts = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/eda_facts.json"), "utf8"),
);

describe("derive() invariants against the real eda_facts.json", () => {
  const d = derive(real, "es");

  it("panel counts pass through unchanged", () => {
    expect(d.nSeries).toBe(real.panel.n_series_structural);
    expect(d.nWithF).toBe(real.panel.n_series_with_F);
    expect(d.nEval).toBe(real.panel.n_series_evaluable);
    expect(d.pctF).toBe(real.panel.pct_trainable_F);
    expect(d.pctFrozen).toBe(Math.round(real.panel.pct_frozen));
    expect(d.pctRetro).toBe(real.panel.pct_retro.toFixed(1));
  });

  it("nObs and dvRows are locale-formatted, not raw", () => {
    expect(d.nObs).toBe(real.panel.n_obs.toLocaleString("es-MX"));
    expect(d.dvRows).toBe((real.dv?.n_rows ?? 0).toLocaleString("es-MX"));
    // en-US uses the same comma grouping but the function must honor the locale
    expect(derive(real, "en").nObs).toBe(real.panel.n_obs.toLocaleString("en-US"));
  });

  it("worst retrogression = the single biggest event, in years", () => {
    const worst = real.retro_events.reduce((a, b) => (b.days > a.days ? b : a));
    expect(d.worstYears).toBe((worst.days / 365.25).toFixed(1));
    expect(d.worstLabel).not.toBe(""); // a real event resolves to a label
  });

  it("stationarity census matches the summary, never a subtraction", () => {
    expect(d.nDiff).toBe(real.stationarity_summary.difference ?? 0);
    expect(d.nMixed).toBe(real.stationarity_summary.mixed ?? 0);
    expect(d.nLevel).toBe(real.stationarity_summary.stationary ?? 0);
  });

  it("no derived number is NaN", () => {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === "number") expect(Number.isNaN(v), `${k} is NaN`).toBe(false);
    }
  });

  it("is deterministic (same input → same output)", () => {
    expect(derive(real, "es")).toEqual(d);
  });
});

// Minimal empty-census fixture: exercises the anti-"0 de 74" guards.
const empty: EdaFacts = {
  vintage: "2026-07",
  panel: {
    n_obs: 27611,
    n_series_structural: 194,
    n_series_with_F: 136,
    n_series_evaluable: 74,
    n_obs_F: 15931,
    pct_trainable_F: 58,
    n_months: 296,
    date_first: "2001-12",
    date_last: "2026-07",
    pct_retro: 2.4,
    pct_frozen: 45,
    median_step_days: 7,
  },
  regime: { F: 15931, C: 0, U: 0, UNK: 0 },
  stationarity_summary: {}, // census missing
  series: [],
  retro_events: [],
  fad_dff_gap: [],
  backlog_today: [],
  monthly_advance_median: {}, // no advance map
  dv: { n_rows: 1647 },
};

describe("derive() guards a missing census instead of lying", () => {
  const d = derive(empty, "es");

  it("hides g09 (stationarity) rather than asserting '0 de 74'", () => {
    expect(d.hasStationarity).toBe(false);
    expect(d.nDiff + d.nMixed + d.nLevel).toBe(0);
  });

  it("hides g06 (advance) rather than asserting 'entre 0 y 0'", () => {
    expect(d.hasAdvance).toBe(false);
  });

  it("still passes through the panel counts and formats nObs", () => {
    expect(d.nSeries).toBe(194);
    expect(d.nObs).toBe((27611).toLocaleString("es-MX"));
    expect(d.worstLabel).toBe(""); // no retro events → empty, not a crash
  });

  it("an all-zero advance map is treated as no exploitable signal", () => {
    const d2 = derive({ ...empty, monthly_advance_median: { "1": 0, "2": 0 } }, "es");
    expect(d2.hasAdvance).toBe(false);
  });
});
