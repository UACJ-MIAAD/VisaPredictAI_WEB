import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import {
  buildLine, buildMovement, buildStatus, buildCompare, buildMonthTable,
  buildPanorama, buildHeatmap, buildMultiLine, buildRadar,
} from "@/lib/visabot/analytics";
import { PANEL_CSV } from "./fixtures";

const panel = buildPanel(PANEL_CSV);

describe("chart builders", () => {
  it("buildLine returns a dated priority-date series", () => {
    const s = buildLine(panel, "mexico", "F1", "FAD", "es");
    expect(s?.kind).toBe("line");
    if (s?.kind !== "line") throw new Error("no line");
    expect(s.data.length).toBe(3);
    expect(s.data.some((d) => d.year != null)).toBe(true);
  });

  it("buildMovement computes the exact month-to-month deltas", () => {
    const s = buildMovement(panel, "mexico", "F1", "FAD", "es");
    expect(s?.kind).toBe("movement");
    if (s?.kind !== "movement") throw new Error("no movement");
    // 2024-08 vs 07 = +31, 2024-09 vs 08 = -14 (the first month has no delta)
    expect(s.data.map((d) => d.movement)).toEqual([31, -14]);
  });

  it("buildStatus tallies the C/F/U regimes", () => {
    const s = buildStatus(panel, "es");
    expect(s.kind).toBe("status");
    if (s.kind !== "status") throw new Error("no status");
    const total = s.data.reduce((a, d) => a + d.value, 0);
    expect(total).toBe(panel.rows.length);
  });

  it("buildCompare ranks the pilot backlog for a category", () => {
    const s = buildCompare(panel, "F1", "FAD", "es");
    expect(s?.kind).toBe("compare");
    if (s?.kind !== "compare") throw new Error("no compare");
    const mx = s.data.find((d) => d.country === "mexico");
    expect(mx?.years).toBeGreaterThan(0);
  });

  it("buildMonthTable builds category×country sections for a month", () => {
    const s = buildMonthTable(panel, "2024-07", "FAD", "es");
    expect(s?.kind).toBe("table");
    if (s?.kind !== "table") throw new Error("no table");
    expect(s.sections.length).toBeGreaterThan(0);
    expect(s.countries.length).toBeGreaterThan(0);
  });

  it("buildPanorama returns six KPIs", () => {
    const k = buildPanorama(panel, "en");
    expect(k).toHaveLength(6);
    expect(k.every((x) => x.value && x.label)).toBe(true);
  });

  it("buildHeatmap returns a family grid", () => {
    const s = buildHeatmap(panel, "familia", "FAD", "es");
    expect(s?.kind).toBe("heatmap");
    if (s?.kind !== "heatmap") throw new Error("no heatmap");
    expect(s.rows.length).toBeGreaterThan(0);
    expect(s.cols.length).toBeGreaterThan(0);
    expect(s.m.length).toBe(s.rows.length);
  });

  it("buildMultiLine returns null when fewer than two countries share the category", () => {
    // only mexico has F1 in the fixture → not a race
    expect(buildMultiLine(panel, "F1", "FAD", "es")).toBeNull();
  });

  it("buildRadar returns null without enough family categories", () => {
    // fixture has only F1 + F2A present (<3) → no radar
    expect(buildRadar(panel, "FAD", "es")).toBeNull();
  });
});
