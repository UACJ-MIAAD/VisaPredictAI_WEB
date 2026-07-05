// BB5 — the drift-baseline primitives extracted from buildForecast. These are
// the ILLUSTRATIVE in-browser fallback (OLS drift + √h random-walk bands), not
// the production model, and the tests pin that documented behavior.
import { describe, it, expect } from "vitest";
import { fitDrift, driftBands, bandOf } from "@/lib/visabot/analytics";

describe("fitDrift", () => {
  it("recovers the exact slope of a perfectly linear series, with sigma 0", () => {
    const fit = fitDrift([10, 20, 30, 40, 50]);
    expect(fit.slope).toBeCloseTo(10, 10);
    expect(fit.sigma).toBeCloseTo(0, 10);
    expect(fit.last).toBe(50);
  });

  it("returns slope 0 and sigma 0 for a constant (frozen) series", () => {
    const fit = fitDrift([7, 7, 7, 7, 7, 7]);
    expect(fit.slope).toBe(0);
    expect(fit.sigma).toBe(0);
    expect(fit.last).toBe(7);
  });

  it("handles a retrogressing series (negative slope)", () => {
    const fit = fitDrift([100, 90, 80, 70]);
    expect(fit.slope).toBeCloseTo(-10, 10);
  });

  it("keeps sigma non-negative on noisy data and anchors last to the final value", () => {
    const ys = [0, 35, 55, 100, 118, 165, 178, 224];
    const fit = fitDrift(ys);
    expect(fit.sigma).toBeGreaterThanOrEqual(0);
    expect(fit.slope).toBeGreaterThan(0);
    expect(fit.last).toBe(224);
  });

  it("degrades a single observation to slope 0 / sigma 0", () => {
    expect(fitDrift([42])).toEqual({ slope: 0, sigma: 0, last: 42 });
  });
});

describe("driftBands", () => {
  const fit = { slope: 3, sigma: 2, last: 100 };

  it("projects the point linearly from the anchor: last + slope·h", () => {
    expect(driftBands(fit, 1).point).toBeCloseTo(103, 10);
    expect(driftBands(fit, 12).point).toBeCloseTo(136, 10);
  });

  it("orders the bands lo95 ≤ lo80 ≤ point ≤ hi80 ≤ hi95", () => {
    const b = driftBands(fit, 6);
    expect(b.lo95).toBeLessThanOrEqual(b.lo80);
    expect(b.lo80).toBeLessThanOrEqual(b.point);
    expect(b.point).toBeLessThanOrEqual(b.hi80);
    expect(b.hi80).toBeLessThanOrEqual(b.hi95);
  });

  it("widens monotonically with the horizon (√h)", () => {
    let prev = 0;
    for (let h = 1; h <= 12; h++) {
      const b = driftBands(fit, h);
      const width = b.hi95 - b.lo95;
      expect(width).toBeGreaterThan(prev);
      prev = width;
    }
  });

  it("collapses to the point when sigma is 0", () => {
    const b = driftBands({ slope: 5, sigma: 0, last: 10 }, 4);
    expect(b.lo95).toBe(b.point);
    expect(b.hi95).toBe(b.point);
    expect(b.point).toBe(30);
  });
});

describe("bandOf", () => {
  it("passes a real band tuple through unchanged", () => {
    expect(bandOf([1.5, 2.5])).toEqual([1.5, 2.5]);
  });

  it("degrades null/undefined to NaN bounds instead of throwing", () => {
    for (const v of bandOf(null)) expect(Number.isNaN(v)).toBe(true);
    for (const v of bandOf(undefined)) expect(Number.isNaN(v)).toBe(true);
  });
});
