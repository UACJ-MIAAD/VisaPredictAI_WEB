/**
 * F6 · el gancho de cohorte está preparado y hoy no pinta nada.
 *
 * Auditoría de partida: `web_forecasts_meta.json` NO declara cohortes en ninguna de sus 97 series
 * (la palabra no aparece en el artefacto) y su contrato vendorizado tampoco la exige. La dirección
 * del director —partir el panel en estables y no estables— llegará como campo del metadata
 * gobernado; hasta entonces la interfaz debe quedarse EXACTAMENTE como está.
 *
 * ⚠️ La suite de este repositorio corre en entorno `node`, sin DOM ni librerías de render (y añadir
 * dependencias está fuera de alcance). Por eso el ES/EN y la accesibilidad se prueban sobre la
 * función pura que construye la etiqueta y sobre el uso que el componente hace de ella, no
 * renderizando: se dice aquí para que nadie lea más garantía de la que hay.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COHORT_MAX_LEN, cohortLabel, cohortOrNull, readCohort } from "../lib/data/cohort.mjs";

const ROOT = resolve(__dirname, "..");
const META = JSON.parse(readFileSync(resolve(ROOT, "public/data/forecasts_meta.json"), "utf8"));
const BADGE = readFileSync(resolve(ROOT, "components/ui/cohort-badge.tsx"), "utf8");
const CARD = readFileSync(resolve(ROOT, "components/sections/forecast-card.tsx"), "utf8");

describe("the published cut declares no cohort", () => {
  it("no series carries the field", () => {
    const series = Object.values(META.series as Record<string, object>);
    expect(series.length).toBeGreaterThan(50);
    expect(series.filter((s) => "cohort" in s)).toHaveLength(0);
  });

  it("the vendored contract does not require it", () => {
    const contrato = JSON.parse(readFileSync(resolve(ROOT, "lib/contracts/web_forecasts_meta.json"), "utf8"));
    expect(Object.keys(contrato.required_keys)).not.toContain("cohort");
  });

  it.each(Object.entries(META.series as Record<string, object>).slice(0, 6))(
    "reads null for the real series %s, so the card renders exactly as today",
    (_clave, serie) => {
      expect(readCohort(serie)).toBeNull();
      expect(cohortOrNull(serie)).toBeNull();
    },
  );

  it.each([null, undefined, {}, { n_obs: 298 }, { cohort: null }])("absence yields null (%s)", (meta) => {
    expect(cohortOrNull(meta)).toBeNull();
  });
});

describe("when the cut declares one, it comes only from the metadata", () => {
  it.each([
    ["cadena suelta", { cohort: "estables" }, "estables"],
    ["objeto con id", { cohort: { id: "no-estables" } }, "no-estables"],
    ["con espacios alrededor", { cohort: "  estables  " }, "estables"],
    ["en el límite de longitud", { cohort: "x".repeat(COHORT_MAX_LEN) }, "x".repeat(COHORT_MAX_LEN)],
  ])("reads %s", (_caso, meta, esperado) => {
    expect(readCohort(meta)).toBe(esperado);
  });

  it("does not derive a cohort from anything else in the series", () => {
    // Control benigno: una serie rica en campos NO produce insignia por su cuenta.
    expect(readCohort({ n_obs: 298, models: ["ets"], mase: 0.18, last_month: "2026-09" })).toBeNull();
  });
});

describe("the label is built for both languages", () => {
  it.each([
    ["es", "Cohorte: estables"],
    ["en", "Cohort: estables"],
  ])("%s", (lang, esperado) => {
    expect(cohortLabel("estables", lang)).toBe(esperado);
  });

  it("the badge uses that label for both accessible hooks", () => {
    expect(BADGE).toMatch(/const etiqueta = cohortLabel\(cohorte, lang\)/);
    expect(BADGE).toMatch(/aria-label=\{etiqueta\}/);
    expect(BADGE).toMatch(/title=\{etiqueta\}/);
  });

  it("shows the identifier verbatim, inventing no taxonomy", () => {
    // El identificador se imprime tal cual, sin envolverlo en prosa ni traducirlo.
    expect(BADGE).toMatch(/\{cohorte\}\s*\n?\s*<\/span>/);
    expect(BADGE).not.toMatch(/estable|inestable|grupo|cohorte:/i);
  });
});

describe("anything malformed fails closed", () => {
  it.each([
    ["vacío", { cohort: "" }],
    ["solo espacios", { cohort: "   " }],
    ["numérico", { cohort: 42 }],
    ["booleano", { cohort: true }],
    ["lista", { cohort: ["estables"] }],
    ["objeto sin id", { cohort: {} }],
    ["id no textual", { cohort: { id: 7 } }],
    ["demasiado largo", { cohort: "x".repeat(COHORT_MAX_LEN + 1) }],
    ["con forma inesperada", { cohort: "<script>alert(1)</script>" }],
  ])("throws on %s", (_caso, meta) => {
    expect(() => readCohort(meta)).toThrow(/cohort/);
  });

  it.each([{ cohort: "" }, { cohort: 42 }, { cohort: ["x"] }, { cohort: {} }, { cohort: "<script>" }])(
    "the UI reader degrades to null rather than inventing a badge (%s)",
    (meta) => {
      expect(cohortOrNull(meta)).toBeNull();
    },
  );

  it("refuses a metadata that is not an object", () => {
    expect(() => readCohort([] as never)).toThrow(/una lista/);
    expect(() => readCohort("x" as never)).toThrow(/string/);
  });
});

describe("the hook duplicates no data and disturbs nothing", () => {
  it("the badge reads the metadata the card already has", () => {
    expect(BADGE).not.toMatch(/fetch\(|await import\(|"\/data\//);
    expect(CARD).toMatch(/<CohortBadge meta=\{series\} \/>/);
  });

  it("the card keeps its deep link, its ordering handles and its dense mode", () => {
    for (const invariante of ["onOpen", "onPin", "aria-pressed", "dense", "maseTier"]) {
      expect(CARD).toContain(invariante);
    }
  });
});
