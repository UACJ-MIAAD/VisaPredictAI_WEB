/**
 * F4 · el asistente responde cifras desde los artefactos gobernados, no de oídas.
 *
 * Auditoría de partida: el constructor del índice NO leía `key_facts.json` ni `eda_facts.json`
 * (cero menciones). Todas las cifras llegaban por prosa —la página, la tarjeta del modelo, la
 * auditoría—, que es exactamente por qué una frase corregida en el sitio podía seguir viva en el
 * corpus. Y el pin del corte se calculaba pero solo se REGISTRABA: un índice incoherente con el
 * corte servido pasaba con una nota en consola.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EDA_SHEET_FIELDS, FACT_SHEET_FIELDS, assertPinCoherent, collectFactSheet } from "../lib/fact-sheet.mjs";

const root = resolve(__dirname, "..");
const KEY = JSON.parse(readFileSync(resolve(root, "public/data/key_facts.json"), "utf8"));
const EDA = JSON.parse(readFileSync(resolve(root, "public/data/eda_facts.json"), "utf8"));
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const hoja = () => collectFactSheet(KEY, EDA);
const texto = (id: string) => hoja().find((c) => c.id === id)!.text;

describe("the sheet is derived, in both languages", () => {
  it("emits one card and one EDA chunk per language, in a fixed order", () => {
    expect(hoja().map((c) => c.id)).toEqual(["fact-sheet-es", "fact-sheet-en", "eda-sheet-es", "eda-sheet-en"]);
  });

  it("carries every declared field", () => {
    for (const [, , etiqueta] of FACT_SHEET_FIELDS) expect(texto("fact-sheet-es")).toContain(etiqueta);
    for (const [, etiqueta] of EDA_SHEET_FIELDS) expect(texto("eda-sheet-es")).toContain(etiqueta);
  });

  it("states the population next to a figure that has one", () => {
    // Un MASE sin decir que se mide solo sobre estado F es una cifra que engaña.
    expect(texto("fact-sheet-es")).toMatch(/MASE prospectivo.*estado F/);
  });

  it("is deterministic: the same input yields the same bytes", () => {
    expect(JSON.stringify(collectFactSheet(KEY, EDA))).toBe(JSON.stringify(collectFactSheet(clonar(KEY), clonar(EDA))));
  });

  it("takes its values from the artifact and not from a literal", () => {
    const mutado = clonar(KEY);
    mutado.v2.data.n_obs.value = 12345;
    expect(collectFactSheet(mutado, EDA)[0].text).toContain("12345");
    expect(collectFactSheet(mutado, EDA)[0].text).not.toContain(String(KEY.v2.data.n_obs.value));
  });
});

describe("it fails closed instead of guessing", () => {
  it.each([null, undefined, 42, "x", []])("refuses key_facts that is %s", (malo) => {
    expect(() => collectFactSheet(malo as never, EDA)).toThrow(/key_facts/);
  });

  it("refuses key_facts with no v2 block", () => {
    // Sin variable descartada: se copia y se borra la clave, que además es lo que ocurriría
    // de verdad si un corte emitiera el artefacto sin su bloque `v2`.
    const sinV2 = structuredClone(KEY);
    delete sinV2.v2;
    expect(() => collectFactSheet(sinV2, EDA)).toThrow(/`v2`/);
  });

  it("refuses eda_facts that is absent", () => {
    expect(() => collectFactSheet(KEY, null as never)).toThrow(/eda_facts/);
  });

  it("names the missing section", () => {
    const mutado = clonar(KEY);
    delete mutado.v2.backfill;
    expect(() => collectFactSheet(mutado, EDA)).toThrow(/v2\.backfill/);
  });

  it("names the missing key", () => {
    const mutado = clonar(KEY);
    delete mutado.v2.data.n_months;
    expect(() => collectFactSheet(mutado, EDA)).toThrow(/n_months/);
  });

  it.each([
    ["una lista", []],
    ["un objeto", { value: {} }],
    ["texto suelto", "27911"],
  ])("refuses an entry that is %s", (_caso, valor) => {
    const mutado = clonar(KEY);
    mutado.v2.data.n_obs = valor;
    expect(() => collectFactSheet(mutado, EDA)).toThrow(/n_obs/);
  });

  it("refuses an eda path that is not a scalar", () => {
    const mutado = clonar(EDA);
    mutado.panel.n_months = { raro: true };
    expect(() => collectFactSheet(KEY, mutado)).toThrow(/n_months.*escalar/);
  });

  it("never degrades into prose when something is wrong", () => {
    const mutado = clonar(KEY);
    delete mutado.v2.governance;
    expect(() => collectFactSheet(mutado, EDA)).toThrow();
  });
});

describe("the pin must be coherent when production is fresh", () => {
  it("passes when the served cut and the pinned docs agree", () => {
    expect(assertPinCoherent({ served_release_status: "fresh", coherent: true, release_id: "r", served_release_id: "r" })).toBe("fresh");
  });

  it("fails when production is fresh and the index points elsewhere", () => {
    expect(() =>
      assertPinCoherent({ served_release_status: "fresh", coherent: false, release_id: "viejo", served_release_id: "nuevo" }),
    ).toThrow(/fresh.*nuevo.*viejo|incoherente/);
  });

  it.each([
    ["stale", "stale"],
    ["legacy", "legacy"],
    ["incompatible", "incompatible"],
  ])("lets a %s cut through under its own contract, without calling it fresh", (estado, esperado) => {
    const salida = assertPinCoherent({ served_release_status: estado, coherent: false });
    expect(salida).toBe(esperado);
    expect(salida).not.toBe("fresh");
  });

  it.each([null, undefined, "n/d"])("reports an absent state as absent, not as fresh (%s)", (estado) => {
    expect(assertPinCoherent({ served_release_status: estado, coherent: false })).toBe("absent");
  });

  it("refuses a state it does not know", () => {
    expect(() => assertPinCoherent({ served_release_status: "raro", coherent: true })).toThrow(/desconocido/);
  });

  it("an incoherent pin on a NON fresh cut is not an error", () => {
    // Control benigno: la exigencia es de producción fresca, no de cualquier build local.
    expect(() => assertPinCoherent({ served_release_status: "stale", coherent: false })).not.toThrow();
  });
});

describe("the probes are grounded in the sheet", () => {
  const casos = JSON.parse(readFileSync(resolve(root, "scripts/rag-eval-set.json"), "utf8")).cases;

  it("the three new probes exist in the eval set", () => {
    const nuevas = casos.filter((c: { q: string }) => /series del panel son evaluables|prospective MASE of the deployed|poblaci[oó]n est[aá] medida la cobertura/.test(c.q));
    expect(nuevas).toHaveLength(3);
  });

  it.each([
    ["es", /\b74\b/],
    ["en", /0\.347/],
  ])("the %s card grounds its probe", (lang, rx) => {
    expect(texto(`fact-sheet-${lang}`)).toMatch(rx);
  });

  it("the population probe is grounded, and only the sheet carries it", () => {
    expect(texto("fact-sheet-es")).toMatch(/estado F/);
  });
});

describe("the REPO_DOCS extension is declared, not copied", () => {
  const src = readFileSync(resolve(root, "scripts/build-rag-index.mjs"), "utf8");

  it.each(["docs/FORECAST_EVAL.md", "docs/CLEANING.md", "docs/PROMOTION_POLICY.md", "docs/ENGINEERING.md"])(
    "%s is fetched, not summarised",
    (doc) => {
      expect(src).toContain(`["${doc}"`);
    },
  );

  it("no figure is typed into the titles the index will show", () => {
    // La propiedad es que el índice cite los documentos, no que los resuma: un título con una
    // cifra sería una copia que envejece aparte de su fuente. (Los comentarios del bloque sí
    // pueden mencionar un año; lo que no puede llevar cifras es lo que se indexa.)
    const bloque = src.slice(src.indexOf("const REPO_DOCS"), src.indexOf("];", src.indexOf("const REPO_DOCS")));
    const titulos = [...bloque.matchAll(/\[\s*"[^"]+",\s*"([^"]+)"\s*\]/g)].map((m) => m[1]);
    expect(titulos.length).toBeGreaterThanOrEqual(11);
    for (const t of titulos) expect(t).not.toMatch(/\d/);
  });
});
