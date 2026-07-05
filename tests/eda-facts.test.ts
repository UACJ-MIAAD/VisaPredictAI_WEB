import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { isEdaFacts } from "@/lib/data/eda";

// Minimal hand-built fixture satisfying every guard clause.
const MIN = {
  vintage: "2026-07",
  panel: { n_obs: 27611, pct_retro: 2.42 },
  regime: { F: 15931, C: 11058, U: 621, UNK: 1 },
  stationarity_summary: { difference: 71, mixed: 3 },
  monthly_advance_median: { "mexico|F1|FAD": 14 },
  series: [{ country: "mexico", block: "family", category: "F1", table: "FAD", n_F: 100, pct_frozen: 40 }],
  retro_events: [],
  fad_dff_gap: [],
  backlog_today: [],
  dv: { n_rows: 1647 },
};
const variant = (over: Record<string, unknown>) => ({ ...MIN, ...over });

describe("isEdaFacts", () => {
  it("accepts the real committed eda_facts.json fallback", () => {
    const real: unknown = JSON.parse(
      readFileSync(new URL("../public/data/eda_facts.json", import.meta.url), "utf8"),
    );
    expect(isEdaFacts(real)).toBe(true);
  });

  it("accepts a minimal valid fixture", () => {
    expect(isEdaFacts(MIN)).toBe(true);
  });

  it("rejects null / non-objects / missing panel", () => {
    expect(isEdaFacts(null)).toBe(false);
    expect(isEdaFacts("json")).toBe(false);
    expect(isEdaFacts(variant({ panel: undefined }))).toBe(false);
  });

  it("rejects an empty series census (would render '0 de 74' lies)", () => {
    expect(isEdaFacts(variant({ series: [] }))).toBe(false);
  });

  it("rejects empty or non-finite summary records", () => {
    expect(isEdaFacts(variant({ stationarity_summary: {} }))).toBe(false);
    expect(isEdaFacts(variant({ stationarity_summary: { difference: NaN } }))).toBe(false);
    expect(isEdaFacts(variant({ monthly_advance_median: { x: "14" } }))).toBe(false);
  });

  it("rejects a dv block without a numeric row count", () => {
    expect(isEdaFacts(variant({ dv: {} }))).toBe(false);
    expect(isEdaFacts(variant({ dv: undefined }))).toBe(false);
  });
});
