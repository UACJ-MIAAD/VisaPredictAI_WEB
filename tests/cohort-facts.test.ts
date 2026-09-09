import { describe, expect, it } from "vitest";

import { COHORT_FACT_FIELDS, cohortSentence, readCohortFacts } from "../lib/data/cohort-facts.mjs";

const VALIDO = {
  NSeriesEvaluable: 74,
  NEstable: 39,
  NNoEstable: 35,
  RuleVersion: "1.0.0",
  ScanBate: 0,
  CampanaBate: 0,
  RouterCeldas: 4,
  RouterGana: 0,
};

describe("cifras de cohortes: ausencia tolerada, presencia validada", () => {
  it("devuelve null cuando el corte no las trae — que es el caso de hoy", () => {
    expect(readCohortFacts(null)).toBeNull();
    expect(readCohortFacts(undefined)).toBeNull();
  });

  it("no inventa nada cuando faltan: la frase del asistente también es null", () => {
    expect(cohortSentence(null)).toBeNull();
    expect(cohortSentence(readCohortFacts(null), "en")).toBeNull();
  });

  it("acepta un artefacto bien formado y expone solo los campos declarados", () => {
    const f = readCohortFacts(VALIDO) as Record<string, number | string>;
    expect(Object.keys(f).sort()).toEqual(COHORT_FACT_FIELDS.map(([k]) => k).sort());
    expect(f.NSeriesEvaluable).toBe(74);
  });

  it("lo presente pero mal formado LANZA, en vez de servir un número no validable", () => {
    expect(() => readCohortFacts([])).toThrow(/no es un objeto/);
    expect(() => readCohortFacts("74")).toThrow(/no es un objeto/);
    expect(() => readCohortFacts({ ...VALIDO, NEstable: undefined })).toThrow(/sin el campo/);
    expect(() => readCohortFacts({ ...VALIDO, NEstable: -1 })).toThrow(/entero no negativo/);
    expect(() => readCohortFacts({ ...VALIDO, NEstable: 39.5 })).toThrow(/entero no negativo/);
    expect(() => readCohortFacts({ ...VALIDO, RuleVersion: "" })).toThrow(/cadena no vacía/);
  });

  it("rechaza una partición que no cuadra: 39 + 35 tienen que ser 74", () => {
    expect(() => readCohortFacts({ ...VALIDO, NNoEstable: 34 })).toThrow(/no suman/);
  });

  it("la frase lleva el resultado negativo, no solo la partición", () => {
    const es = cohortSentence(readCohortFacts(VALIDO));
    const en = cohortSentence(readCohortFacts(VALIDO), "en");
    for (const frase of [es!, en!]) {
      expect(frase).toContain("74");
      expect(frase).toContain("39");
      expect(frase).toContain("35");
    }
    expect(es).toContain("baten al naïve-1");
    expect(en).toContain("beat their own cohort's naive-1");
  });

  it("una victoria distinta de cero se reportaría igual: la frase se deriva", () => {
    const frase = cohortSentence(readCohortFacts({ ...VALIDO, RouterGana: 2 }));
    expect(frase).toContain("de 4 celdas de enrutado, 2 baten");
  });
});
