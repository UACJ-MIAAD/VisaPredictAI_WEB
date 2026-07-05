// Derived-signal layer for the /resultados gallery: panel index, per-series
// backlog + projected movement, the "reaches my priority date?" answer, and the
// gallery's sort / MASE-tercile helpers. All computed from the data — no hardcode.
import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import { buildPanelIndex, seriesSignals, reachesPriorityDate } from "@/lib/visabot/analytics";
import { sortSeries, maseTerciles, maseTier, attachSignals, buildGallerySeries, buildGalleryTree, type GallerySeries } from "@/lib/visabot/gallery";
import type { ForecastPoint, ForecastStore, SeriesMeta } from "@/lib/data/forecasts";
import { linearSeriesCsv } from "./fixtures";

// mexico F4 FAD: 12 F months advancing +30 d/mo, last days_since_base = 9030+12*30 = 9390... (fixture starts at 9000, first +30)
const panel = buildPanel(linearSeriesCsv(12, 30));
const index = buildPanelIndex(panel);
const rows = index.get("mexico|F4|FAD");
const lastF = rows!.filter((r) => r.status === "F").at(-1)!;
const lastDays = lastF.daysSinceBase as number;

// a synthetic forecast continuing the advance: +30 d/mo for 12 months
const fc: ForecastPoint[] = Array.from({ length: 12 }, (_, i) => {
  const days = lastDays + 30 * (i + 1);
  return { date: `2024-${String(i + 1).padStart(2, "0")}`, days, lo80: days - 20, hi80: days + 20, lo95: days - 40, hi95: days + 40 };
});

describe("buildPanelIndex", () => {
  it("groups rows by country|category|table, sorted ascending by month", () => {
    const r = index.get("mexico|F4|FAD")!;
    expect(r.length).toBe(12);
    for (let i = 1; i < r.length; i++) expect(r[i].bulletinMonth >= r[i - 1].bulletinMonth).toBe(true);
  });
  it("returns the SAME rows a full scan would (index parity)", () => {
    const scan = panel.rows.filter((x) => x.country === "mexico" && x.category === "F4" && x.table === "FAD");
    expect(index.get("mexico|F4|FAD")!.length).toBe(scan.length);
  });
});

describe("seriesSignals", () => {
  it("derives a positive backlog and a positive projected movement for an advancing series", () => {
    const s = seriesSignals(rows, fc, 12);
    expect(s.backlogYears).not.toBeNull();
    expect(s.backlogYears as number).toBeGreaterThan(0);
    expect(s.movementDays).toBe(fc.at(-1)!.days - lastDays); // 360
    expect(s.movementPerYear).toBeCloseTo(360, 0); // 360 d over 12 mo = 360 d/yr
    expect(s.backlogDate).toBe(lastF.priorityDate);
  });
  it("returns nulls when there are no F rows", () => {
    const s = seriesSignals([], fc, 12);
    expect(s).toEqual({ backlogYears: null, backlogDate: null, movementDays: null, movementPerYear: null });
  });
  it("has null movement when no forecast is supplied but still a backlog", () => {
    const s = seriesSignals(rows, null, 12);
    expect(s.movementDays).toBeNull();
    expect(s.backlogYears as number).toBeGreaterThan(0);
  });
});

describe("reachesPriorityDate", () => {
  const iso = (d: number) => new Date((Date.UTC(1975, 0, 1) / 86400000 + d) * 86400000).toISOString().slice(0, 10);
  it("says 'past' when the date is already behind the current cutoff", () => {
    expect(reachesPriorityDate(rows, fc, iso(lastDays - 100)).status).toBe("past");
  });
  it("says 'within' and names the month when the cutoff is projected to cross it", () => {
    const r = reachesPriorityDate(rows, fc, iso(lastDays + 45)); // between fc[0]=+30 and fc[1]=+60
    expect(r.status).toBe("within");
    expect(r.month).toBe("2024-02");
  });
  it("says 'beyond' when the date is past the last projected point", () => {
    expect(reachesPriorityDate(rows, fc, iso(lastDays + 9999)).status).toBe("beyond");
  });
  it("says 'invalid' on a malformed date", () => {
    expect(reachesPriorityDate(rows, fc, "not-a-date").status).toBe("invalid");
  });
});

// ── gallery pure helpers ────────────────────────────────────────────────────
const mk = (key: string, mase: number | null, backlog: number | null, mv: number | null): GallerySeries => ({
  key, country: "mexico", category: "F4", table: "FAD", block: "familia",
  mase, models: [], lastMonth: null, nFObs: null, backlogYears: backlog, movementDays: mv, movementPerYear: mv,
});

describe("maseTerciles / maseTier", () => {
  const series = [mk("a", 0.1, 1, 1), mk("b", 0.2, 2, 2), mk("c", 0.3, 3, 3), mk("d", 0.4, 4, 4), mk("e", 0.5, 5, 5), mk("f", 0.6, 6, 6)];
  it("splits the observed distribution into terciles (no typed cutoff)", () => {
    const t = maseTerciles(series)!;
    expect(t.t1).toBeLessThan(t.t2);
    expect(maseTier(0.1, t)).toBe("good");
    expect(maseTier(0.6, t)).toBe("weak");
    expect(maseTier(null, t)).toBeNull();
  });
  it("returns null with too few graded series", () => {
    expect(maseTerciles([mk("a", 0.1, 1, 1)])).toBeNull();
  });
});

describe("attachSignals", () => {
  it("enriches the leaf set with backlog + movement from the panel + store", () => {
    const meta = new Map<string, SeriesMeta>([["mexico|F4|FAD", { models: ["ets"], mase: 0.1, last_month: "2023-12" }]]);
    const store: ForecastStore = { method: {}, series: new Map([["mexico|F4|FAD", fc]]), meta, scorecard: null, horizonMonths: 12 };
    const enriched = attachSignals(buildGallerySeries(store), store, index);
    const s = enriched.find((x) => x.key === "mexico|F4|FAD")!;
    expect(s.backlogYears as number).toBeGreaterThan(0);
    expect(s.movementDays).toBe(fc.at(-1)!.days - lastDays);
  });
});

describe("buildGalleryTree featured (superlative, not 5×F1)", () => {
  it("picks each country's largest-backlog series, not a fixed category", () => {
    const s: GallerySeries[] = [
      { ...mk("mexico|F1|FAD", 0.1, 2, 0), country: "mexico", category: "F1" },
      { ...mk("mexico|F4|FAD", 0.2, 30, 0), country: "mexico", category: "F4" },
    ];
    const feat = buildGalleryTree(s).featured.find((x) => x.country === "mexico");
    expect(feat?.category).toBe("F4"); // 30 yr backlog beats 2 yr
  });
});

describe("sortSeries", () => {
  const series = [mk("a", 0.3, 1, 5), mk("b", 0.1, 9, 1), mk("c", 0.2, 4, 9), mk("nul", null, null, null)];
  it("'order' keeps the incoming order", () => {
    expect(sortSeries(series, "order").map((s) => s.key)).toEqual(["a", "b", "c", "nul"]);
  });
  it("'mase' sorts sharpest (lowest) first, nulls last", () => {
    expect(sortSeries(series, "mase").map((s) => s.key)).toEqual(["b", "c", "a", "nul"]);
  });
  it("'backlog' sorts longest wait first, nulls last", () => {
    expect(sortSeries(series, "backlog").map((s) => s.key)).toEqual(["b", "c", "a", "nul"]);
  });
  it("'movement' sorts fastest advancing first, nulls last", () => {
    expect(sortSeries(series, "movement").map((s) => s.key)).toEqual(["c", "a", "b", "nul"]);
  });
});
