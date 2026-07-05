import { describe, it, expect } from "vitest";
import { buildGallerySeries, buildGalleryTree, gallerySummary, filterSeries, blockOf } from "@/lib/visabot/gallery";
import type { ForecastStore, ForecastPoint, SeriesMeta } from "@/lib/data/forecasts";

function mockStore(keys: string[]): ForecastStore {
  const series = new Map<string, ForecastPoint[]>();
  const meta = new Map<string, SeriesMeta>();
  const pt: ForecastPoint = { date: "2026-08", days: 1, lo80: 0, hi80: 2, lo95: -1, hi95: 3 };
  for (const k of keys) {
    series.set(k, [pt]);
    meta.set(k, { models: ["theta", "ets"], mase: 0.1, last_month: "2026-07" });
  }
  return { method: {}, series, meta, scorecard: null };
}

const KEYS = [
  "mexico|F2A|FAD", "mexico|F2A|DFF", "india|EB2|FAD",
  "china|EB5|FAD", "philippines|F4|FAD", "all_chargeability|F1|FAD",
];
const store = mockStore(KEYS);

describe("blockOf", () => {
  it("splits family (F*) vs employment (EB*)", () => {
    expect(blockOf("F2A")).toBe("familia");
    expect(blockOf("EB5_TEA")).toBe("empleo");
  });
});

describe("buildGallerySeries", () => {
  const s = buildGallerySeries(store);
  it("enumerates every forecast key with parsed fields", () => {
    expect(s).toHaveLength(6);
    const mx = s.find((x) => x.key === "mexico|F2A|FAD")!;
    expect(mx.country).toBe("mexico");
    expect(mx.category).toBe("F2A");
    expect(mx.table).toBe("FAD");
    expect(mx.block).toBe("familia");
    expect(mx.mase).toBe(0.1);
    expect(mx.models).toEqual(["theta", "ets"]);
    expect(mx.lastMonth).toBe("2026-07");
  });
  it("sorts by PILOT country, then category order, then table (FAD before DFF)", () => {
    expect(s.map((x) => x.key)).toEqual([
      "mexico|F2A|FAD", "mexico|F2A|DFF", "india|EB2|FAD",
      "china|EB5|FAD", "philippines|F4|FAD", "all_chargeability|F1|FAD",
    ]);
  });
});

describe("buildGalleryTree", () => {
  const tree = buildGalleryTree(buildGallerySeries(store));
  it("featured = one FAD headline per pilot area", () => {
    expect(tree.featured.map((x) => x.country)).toEqual(["mexico", "india", "china", "philippines", "all_chargeability"]);
    expect(tree.featured.every((x) => x.table === "FAD")).toBe(true);
  });
  it("byCountry is in PILOT order and groups each area's series", () => {
    expect(tree.byCountry.map((g) => g.country)).toEqual(["mexico", "india", "china", "philippines", "all_chargeability"]);
    expect(tree.byCountry[0].series).toHaveLength(2); // mexico F2A FAD + DFF
  });
  it("byCategory is a cross-cut in canonical category order", () => {
    expect(tree.byCategory.map((g) => g.category)).toEqual(["F1", "F2A", "F4", "EB2", "EB5"]);
  });
});

describe("gallerySummary", () => {
  it("derives every count from the series (regla #0)", () => {
    const g = gallerySummary(buildGallerySeries(store));
    expect(g).toMatchObject({ nSeries: 6, nAreas: 5, nFamily: 4, nEmployment: 2, nFAD: 5, nDFF: 1, lastMonth: "2026-07" });
  });
});

describe("filterSeries", () => {
  const s = buildGallerySeries(store);
  it("filters by country / table / block / query", () => {
    expect(filterSeries(s, { country: "mexico" })).toHaveLength(2);
    expect(filterSeries(s, { table: "DFF" })).toHaveLength(1);
    expect(filterSeries(s, { block: "empleo" })).toHaveLength(2);
    expect(filterSeries(s, { query: "eb2" })).toHaveLength(1);
    expect(filterSeries(s, { country: "mexico", table: "FAD" })).toHaveLength(1);
  });
});
