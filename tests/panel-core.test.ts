import { describe, it, expect } from "vitest";
import { parseCsv, computeMovement, buildPanel } from "@/lib/data/panel-core";
import { PANEL_CSV, PANEL_HEADER } from "./fixtures";

describe("parseCsv", () => {
  const rows = parseCsv(PANEL_CSV);

  it("parses every data row", () => {
    expect(rows).toHaveLength(9);
  });

  it("maps block to Spanish (employment→empleo, family→familia)", () => {
    expect(rows[0].block).toBe("familia");
    expect(rows.find((r) => r.country === "india")?.block).toBe("empleo");
  });

  it("truncates bulletin_date to YYYY-MM", () => {
    expect(rows[0].bulletinMonth).toBe("2024-07");
  });

  it("keeps missing cells null (no fabrication)", () => {
    const c = rows.find((r) => r.status === "C");
    expect(c?.priorityDate).toBeNull();
    expect(c?.daysSinceBase).toBeNull();
  });

  it("lets a legitimate 0 in days_since_base survive", () => {
    const zero = rows.find((r) => r.priorityDate === "1975-01-01");
    expect(zero?.daysSinceBase).toBe(0);
  });

  it("fails loud on a missing column", () => {
    const bad = "country,block,category\nmexico,family,F1\n";
    expect(() => parseCsv(bad)).toThrow(/missing column/i);
  });
});

describe("computeMovement", () => {
  it("computes Δ days within the same series, ordered by month", () => {
    const rows = parseCsv(PANEL_CSV);
    computeMovement(rows);
    const mx = rows
      .filter((r) => r.country === "mexico" && r.category === "F1")
      .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
    expect(mx.map((r) => r.movement)).toEqual([null, 31, -14]);
  });

  it("leaves movement null when either month lacks days_since_base", () => {
    const rows = parseCsv(PANEL_CSV);
    computeMovement(rows);
    for (const r of rows.filter((x) => x.country === "philippines"))
      expect(r.movement).toBeNull();
  });
});

describe("buildPanel", () => {
  const panel = buildPanel(PANEL_CSV);

  it("collects sorted dimension values", () => {
    expect(panel.countries).toEqual(["china", "india", "mexico", "philippines"]);
    expect(panel.tables).toEqual(["DFF", "FAD"]);
    expect(panel.categories).toContain("EB5_RURAL");
  });

  it("counts statuses", () => {
    expect(panel.statusCounts).toEqual({ F: 5, C: 2, U: 1, UNK: 1 });
  });

  it("computes the month range", () => {
    expect(panel.monthRange).toEqual(["2010-07", "2024-09"]);
  });

  it("throws on a header-only (empty) CSV", () => {
    expect(() => buildPanel(PANEL_HEADER + "\n")).toThrow(/vac/i);
  });
});
