import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import { parseTwoMonths, buildBulletinDiff, bulletinDiffText } from "@/lib/visabot/analytics";
import { PANEL_CSV } from "./fixtures";

const panel = buildPanel(PANEL_CSV);

describe("parseTwoMonths (compare-bulletins)", () => {
  it("parses two ISO months", () => {
    expect(parseTwoMonths("diff 2024-07 vs 2024-09", panel)).toEqual(["2024-07", "2024-09"]);
  });

  it("parses two named months sharing one year", () => {
    expect(parseTwoMonths("compara julio y septiembre 2024", panel)).toEqual(["2024-07", "2024-09"]);
  });

  it("parses a month+year on each side, returning [older, newer]", () => {
    expect(parseTwoMonths("septiembre 2024 contra julio 2024", panel)).toEqual(["2024-07", "2024-09"]);
  });

  it("returns null when only one month is present", () => {
    expect(parseTwoMonths("boletín de julio 2024", panel)).toBeNull();
  });

  it("does not fire the year fallback for the same year repeated", () => {
    // 2024-01 is absent from the fixture, so only julio 2024 resolves → no valid pair
    expect(parseTwoMonths("compara enero 2024 con julio 2024", panel)).toBeNull();
  });
});

describe("buildBulletinDiff", () => {
  it("computes the signed movement between two bulletins", () => {
    const d = buildBulletinDiff(panel, "2024-07", "2024-09", "FAD", "es");
    expect(d?.kind).toBe("bulletinDiff");
    if (d?.kind !== "bulletinDiff") throw new Error("wrong kind");
    // mexico F1 FAD: 9631 → 9648 days-since-base = +17 days
    expect(d.summary.advanced).toBeGreaterThanOrEqual(1);
    expect(d.summary.topAdvance).toEqual({ cat: "F1", country: "mexico", days: 17 });
    expect(d.monthA).toBe("2024-07");
    expect(d.monthB).toBe("2024-09");
  });

  it("normalizes month order regardless of argument order", () => {
    const d = buildBulletinDiff(panel, "2024-09", "2024-07", "FAD", "en");
    expect(d?.kind === "bulletinDiff" && d.monthA).toBe("2024-07");
  });

  it("returns null for identical months", () => {
    expect(buildBulletinDiff(panel, "2024-07", "2024-07", "FAD", "es")).toBeNull();
  });

  it("emits grounding text carrying the real per-cell transition", () => {
    const d = buildBulletinDiff(panel, "2024-07", "2024-09", "FAD", "es");
    if (d?.kind !== "bulletinDiff") throw new Error("wrong kind");
    const txt = bulletinDiffText(d, "es");
    expect(txt).toContain("F1:");
    expect(txt).toMatch(/\+17d/); // mexico F1 advance
    expect(txt).not.toContain("NaN");
  });
});
