import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cohortChunks, cohortSurface, readCohortFacts } from "../lib/data/cohort-facts.mjs";
import { collectFactSheet } from "../lib/fact-sheet.mjs";
import { buildBM25, retrieveRanked } from "../lib/visabot/retrieval-core.mjs";

// E5 · La superficie visible y los chunks del asistente salen del MISMO `e5_facts.json` del corte.
// El de producción se sirve byte a byte igual al de datos; aquí se lee la copia versionada.
const root = join(__dirname, "..");
const readJson = (rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const E5 = readJson("public/data/e5_facts.json");

// Palabras que delatan prosa española dentro de un texto que se declara inglés. La tarjeta del
// modelo entraba al pool EN sin traducir; esta lista es la sonda de esa regresión.
const ES_MARKERS = /\b(series evaluables|estables?|no estables|baten|cohortes?|celdas|enrutad\w*|exploratorio|evidencia|recetas|corridas|regla)\b/i;

describe("cifras de cohortes extendidas: lo que la superficie cita también se valida", () => {
  it("el artefacto del corte trae el reparto por tabla, el barrido, la campaña y el estado", () => {
    const f = readCohortFacts(E5)!;
    expect(f.byTable).toEqual({ FAD: { estable: 11, no_estable: 30 }, DFF: { estable: 28, no_estable: 5 } });
    expect(f.status).toBe("exploratorio");
    expect(f.RouterGana + f.RouterPierde + f.RouterSinEvidencia).toBe(f.RouterCeldas);
  });

  it("un reparto por tabla que no suma la partición LANZA", () => {
    const malo = { ...E5, cohorts_by_table: { ...E5.cohorts_by_table, FAD: { estable: 12, no_estable: 30 } } };
    expect(() => readCohortFacts(malo)).toThrow(/por tabla/);
  });

  it("veredictos del enrutador que no suman las celdas LANZAN", () => {
    expect(() => readCohortFacts({ ...E5, RouterPierde: 2 })).toThrow(/celdas/);
  });

  it("un estado fuera del vocabulario cerrado LANZA en vez de traducirse a ciegas", () => {
    expect(() => readCohortFacts({ ...E5, status: "promovido" })).toThrow(/estado/);
  });
});

describe("chunks del asistente: uno por lengua, derivados y en su lengua", () => {
  it("sin cifras selladas no hay chunks", () => {
    expect(cohortChunks(null)).toEqual([]);
  });

  it("produce un chunk ES y uno EN con la partición, el reparto por tabla y el resultado negativo", () => {
    const chunks = cohortChunks(readCohortFacts(E5));
    expect(chunks.map((c: { lang: string }) => c.lang)).toEqual(["es", "en"]);
    for (const c of chunks) {
      for (const n of ["74", "39", "35", "11", "30", "28", "5", "42", "18", "66", "24"]) {
        expect(c.text).toMatch(new RegExp(`\\b${n}\\b`));
      }
    }
  });

  it("el chunk EN está escrito en inglés: dice stable/unstable y no arrastra prosa española", () => {
    const en = cohortChunks(readCohortFacts(E5)).find((c: { lang: string }) => c.lang === "en")!;
    expect(`${en.title} ${en.text}`).toMatch(/\bstable\b/i);
    expect(`${en.title} ${en.text}`).toMatch(/\bunstable\b/i);
    expect(`${en.title} ${en.text}`).not.toMatch(ES_MARKERS);
    expect(en.text).toMatch(/\bexploratory\b/);
  });

  it("las cifras se derivan: otro artefacto, otro texto", () => {
    const otro = { ...E5, NEstable: 40, NNoEstable: 34, cohorts_by_table: { FAD: { estable: 12, no_estable: 29 }, DFF: { estable: 28, no_estable: 5 } } };
    const en = cohortChunks(readCohortFacts(otro)).find((c: { lang: string }) => c.lang === "en")!;
    expect(en.text).toMatch(/\b40\b/);
    expect(en.text).not.toMatch(/\b39\b/);
  });
});

describe("superficie visible: la misma fuente, copia completa en cada lengua", () => {
  it("sin cifras no hay superficie", () => {
    expect(cohortSurface(null, "es")).toBeNull();
  });

  it("la copia EN no contiene prosa española y cita las cifras del artefacto", () => {
    const s = cohortSurface(readCohortFacts(E5), "en")!;
    const visible = JSON.stringify(s);
    expect(visible).not.toMatch(ES_MARKERS);
    expect(s.stats.map((x: { value: string }) => x.value)).toEqual(["74", "39", "35", "0 / 4"]);
    expect(s.byTable.map((r: { table: string }) => r.table)).toEqual(["FAD", "DFF"]);
    expect(s.status).toBe("exploratory");
  });

  it("la copia ES cita las mismas cifras", () => {
    const s = cohortSurface(readCohortFacts(E5), "es")!;
    expect(s.stats.map((x: { value: string }) => x.value)).toEqual(["74", "39", "35", "0 / 4"]);
    expect(s.status).toBe("exploratorio");
  });
});

describe("sonda léxica (BM25, sin embeddings): la pregunta inglesa llega al chunk inglés", () => {
  // Distractores reales: la tarjeta de cifras del corte, que también habla de «series evaluables».
  const sheet = collectFactSheet(readJson("public/data/key_facts.json"), readJson("public/data/eda_facts.json"));
  const chunks = [
    ...sheet.map((c: object) => ({ kind: "docs", ...c })),
    ...cohortChunks(readCohortFacts(E5)),
  ];
  const bm25 = buildBM25(chunks);
  const top = (query: string, lang: string) =>
    retrieveRanked({ chunks, vectors: null, dim: 0, bm25, query, qv: null, lang, k: 6 }).selected.map(
      (i: number) => chunks[i],
    );

  it.each([
    ["en", "How many stable and unstable series are there?"],
    ["en", "What are the stability cohorts?"],
    ["en", "Does the cohort router beat naive-1?"],
    ["es", "¿Cuántas series son estables y cuántas no estables?"],
    ["es", "¿El enrutador por cohorte mejora frente al naïve?"],
  ])("%s · %s", (lang, q) => {
    const got = top(q, lang);
    // retrieveRanked now returns number[] (pinGrounding), so `got` is typed by the
    // local array, whose fact-sheet members carry no declared `id`.
    expect(got.some((c) => (c as { id?: string }).id === `cohort-facts-${lang}`)).toBe(true);
  });
});
