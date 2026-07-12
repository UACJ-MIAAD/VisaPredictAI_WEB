// US I3: deterministic guards for the golden set + its library. No model, no
// network — validates the contract that keeps the set honest and the gate sound.
import * as lib from "../scripts/golden-set-lib.mjs";
import { describe, it, expect } from "vitest";

const all = lib.loadGoldenSet("all");
const dev = lib.loadGoldenSet("dev");
const holdout = lib.loadGoldenSet("holdout");

describe("golden set — structure & composition", () => {
  it("is structurally valid (no problems)", () => {
    expect(lib.validateGoldenSet(all)).toEqual([]);
  });

  it("meets the composition floors", () => {
    expect(lib.checkComposition(all)).toEqual([]);
  });

  it("has ≥200 questions and ≥90 per language", () => {
    const c = lib.composition(all);
    expect(c.total).toBeGreaterThanOrEqual(200);
    expect(c.byLang.es).toBeGreaterThanOrEqual(90);
    expect(c.byLang.en).toBeGreaterThanOrEqual(90);
  });

  it("has globally unique ids", () => {
    const ids = all.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("golden set — deterministic hold-out", () => {
  it("splits ~20% into hold-out, disjoint from dev, covering the whole set", () => {
    expect(dev.length + holdout.length).toBe(all.length);
    const frac = holdout.length / all.length;
    expect(frac).toBeGreaterThan(0.1);
    expect(frac).toBeLessThan(0.3);
    const devIds = new Set(dev.map((c: { id: string }) => c.id));
    for (const c of holdout) expect(devIds.has(c.id)).toBe(false);
  });

  it("membership is a stable pure function of the id (idempotent)", () => {
    for (const c of all.slice(0, 20)) expect(lib.isHoldout(c.id)).toBe(lib.isHoldout(c.id));
  });
});

describe("golden set — fact refs resolve to real artifacts (regla #0)", () => {
  it("every ref resolves to a scalar from a real artifact", async () => {
    const refs = new Set<string>();
    for (const c of all) for (const f of c.facts || []) if (f.ref) refs.add(f.ref);
    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) {
      const v = await lib.resolveRef(ref);
      expect(v === null || typeof v === "object").toBe(false);
    }
  });

  it("no fact pattern hard-codes a canonical decimal (must use a ref)", () => {
    for (const c of all) for (const f of c.facts || []) if (f.pattern) expect(/\d+[.,]\d+/.test(f.pattern)).toBe(false);
  });
});

describe("golden set — fact representations", () => {
  it("renders integers with and without thousands separators", () => {
    const reps = lib.factRepresentations(27611);
    expect(reps).toContain("27611");
    expect(reps).toContain("27,611");
  });
  it("keeps year/month granularity for yyyy-mm-dd values", () => {
    const reps = lib.factRepresentations("1975-01-01", "yearmonth");
    expect(reps).toContain("1975-01-01");
    expect(reps).toContain("1975");
  });
  it("never degrades a decimal to a bare 1-digit token", () => {
    for (const r of lib.factRepresentations(0.3474)) expect(r.length).toBeGreaterThanOrEqual(3);
  });
});
