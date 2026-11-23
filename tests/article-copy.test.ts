// /articulo: las afirmaciones cualitativas del texto se re-verifican contra las cifras exportadas
// del manuscrito. Si un corte nuevo cambia el signo o el intervalo, la frase deja de ser cierta y
// esta prueba falla antes de publicarla (regla #0).
import { describe, expect, it } from "vitest";
import data from "@/lib/article/article-facts.json";
import { articleChunks, articleModel, fv } from "@/lib/article/article-copy.mjs";

const es = articleModel(data, "es");
const en = articleModel(data, "en");
const includesZero = ([lo, hi]: number[]) => lo <= 0 && hi >= 0;

describe("article copy claims hold on the exported facts", () => {
  it("linear velocity is distinguishably worse at every horizon", () => {
    for (const h of es.horizons) expect(h.methods.vel.ci[1]).toBeLessThan(0);
  });
  it("neither simulation nor Gaussian random walk is distinguishably better", () => {
    for (const h of es.horizons) {
      expect(h.methods.sim.ci[1]).toBeGreaterThan(0);
      expect(h.methods.sim.ci[0]).toBeLessThan(0);
      expect(h.methods.rw.ci[0]).toBeLessThan(0);
    }
  });
  it("the blend is positive in every design and no 95 % interval excludes zero", () => {
    for (const d of es.designs)
      for (const p of d.points) {
        expect(p.value).toBeGreaterThan(0);
        expect(includesZero(p.ci)).toBe(true);
      }
  });
  it("upper bounds quoted are the upper limits of the primary blend intervals", () => {
    for (const h of es.horizons) expect(Number(h.upper)).toBe(h.methods.blend.ci[1]);
  });
  it("at fifteen years the random walk beats the simulation", () => {
    expect(fv(data, "fBRwFifteen")).toBeLessThan(fv(data, "fBSimFifteen"));
  });
  it("simulated 10–90 % coverage stays under the nominal 0.80", () => {
    for (const n of ["fCovCensOne", "fCovCensFive", "fCovCensTwelve"]) expect(fv(data, n)).toBeLessThan(0.8);
  });
  it("family helps and employment does not at five years; FAD above DFF", () => {
    const g = Object.fromEntries(es.subgroups.map((s) => [s.id, s.points[2]]));
    expect(g.fam.ci[0]).toBeGreaterThan(0);
    expect(includesZero(g.emp.ci)).toBe(true);
    expect(g.fad.value).toBeGreaterThan(g.dff.value);
  });
  it("the out-of-range example has a gap above the largest evaluated gap", () => {
    const out = es.examples.filter((e) => !e.evaluated);
    expect(out).toHaveLength(1);
    expect(Number(out[0].gap)).toBeGreaterThan(Math.max(...es.landscape.gaps));
    for (const e of es.examples.filter((x) => x.evaluated)) expect(Number(e.gap)).toBeLessThanOrEqual(Math.max(...es.landscape.gaps));
  });
});

describe("article copy is complete and symmetric", () => {
  it("ES and EN have the same structure", () => {
    expect(Object.keys(es.sections)).toEqual(Object.keys(en.sections));
    expect(es.faq).toHaveLength(en.faq.length);
    expect(es.examples.map((e) => e.id)).toEqual(en.examples.map((e) => e.id));
  });
  it("titles come from the manuscripts", () => {
    expect(en.title).toBe(data.en.title);
    expect(es.title).toBe(data.es.title);
  });
  it("no LaTeX survives in any chunk and every chunk is bilingual-paired", () => {
    const chunks = articleChunks(data);
    for (const c of chunks) expect(c.text).not.toMatch(/\\|\$|undefined|NaN/);
    const byLang = (l: string) => chunks.filter((c) => c.lang === l).map((c) => c.anchor);
    expect(byLang("es")).toEqual(byLang("en"));
  });
  it("the fact sheet names the resampling method and the cluster count from the facts", () => {
    const sheets = articleChunks(data).filter((c) => c.anchor === "ficha");
    expect(sheets).toHaveLength(2);
    for (const c of sheets) {
      expect(c.text).toMatch(/bootstrap/i);
      expect(c.text).toMatch(/pigeonhole/);
      expect(c.text).toContain(`${data.facts.fClusters.text} `);
    }
  });
  it("a missing macro breaks loudly", () => {
    expect(() => fv({ facts: {} }, "fNope")).toThrow(/fNope/);
  });
});
