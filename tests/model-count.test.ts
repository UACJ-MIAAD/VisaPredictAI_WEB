/**
 * F1 · el número de modelos se deriva del artefacto gobernado, o el build se detiene.
 *
 * Antes vivía como `const nModels = 24` en build-stats con un TODO: el artefacto que lo
 * lleva —reports/governance/key_facts.json— no se consumía. Ya viajaba en el release como
 * `critical`, así que lo único que faltaba era mapearlo y leerlo. Sin fallback: un número
 * de portada equivocado es peor que un build roto.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SITE_STATS } from "../lib/content/site-stats.generated";
import { modelCount, outFor, validateArtifact } from "../lib/release.mjs";

const root = resolve(__dirname, "..");
const CONTRATO = JSON.parse(readFileSync(resolve(root, "lib/contracts/key_facts.json"), "utf8"));
const PUBLICADO = readFileSync(resolve(root, "public/data/key_facts.json"));

const conLlaves = (extra: Record<string, unknown>) =>
  Buffer.from(
    JSON.stringify({
      n_obs: 1,
      n_months: 1,
      n_series_structural: 1,
      n_series_evaluable: 1,
      prosp_mase: 0.5,
      prosp_n_scored: 1,
      ...extra,
    }),
  );

describe("the artifact is consumed at all", () => {
  it("maps into public/data so the build can read it", () => {
    expect(outFor("reports/governance/key_facts.json")).toBe("key_facts.json");
  });

  it("the committed fallback satisfies the vendored contract", () => {
    expect(validateArtifact(CONTRATO, PUBLICADO)).toBe(true);
  });
});

describe("modelCount is fail-closed", () => {
  it("refuses an artifact that violates its contract, naming the key", () => {
    const sinLlave = Buffer.from(JSON.stringify({ n_models: 24 }));
    expect(() => modelCount(CONTRATO, sinLlave)).toThrow(/contrato violado.*n_obs/);
  });

  it("refuses unreadable JSON", () => {
    expect(() => modelCount(CONTRATO, Buffer.from("{no soy json"))).toThrow(/contrato violado.*ilegible/);
  });

  it("refuses an artifact with no model count, instead of guessing one", () => {
    expect(() => modelCount(CONTRATO, conLlaves({}))).toThrow(/falta n_models/);
  });

  it.each([
    ["una cadena", "24"],
    ["un decimal", 24.5],
    ["nulo", null],
    ["booleano", true],
    ["una lista", [24]],
  ])("refuses a count that is %s", (_caso, valor) => {
    expect(() => modelCount(CONTRATO, conLlaves({ n_models: valor }))).toThrow(/n_models/);
  });

  it.each([0, -1])("refuses a non-positive count (%i)", (valor) => {
    expect(() => modelCount(CONTRATO, conLlaves({ n_models: valor }))).toThrow(/positivo/);
  });

  it("never falls back to a typed number when something is wrong", () => {
    // El fallo debe propagarse: devolver 24 «por si acaso» es exactamente lo que F1 retira.
    for (const roto of [conLlaves({}), conLlaves({ n_models: "24" }), Buffer.from("nope")]) {
      expect(() => modelCount(CONTRATO, roto)).toThrow();
    }
  });
});

describe("the benign cases stay silent", () => {
  it("reads the count from the published artifact", () => {
    expect(modelCount(CONTRATO, PUBLICADO)).toBe(SITE_STATS.nModels);
  });

  it("accepts any positive integer, not just today's", () => {
    expect(modelCount(CONTRATO, conLlaves({ n_models: 1 }))).toBe(1);
    expect(modelCount(CONTRATO, conLlaves({ n_models: 99 }))).toBe(99);
  });

  it("ignores extra keys the contract does not mention", () => {
    expect(modelCount(CONTRATO, conLlaves({ n_models: 7, algo_nuevo: "x" }))).toBe(7);
  });
});

describe("the published value did not move", () => {
  it("the generated module still reports the catalog the artifact declares", () => {
    const declarado = JSON.parse(PUBLICADO.toString("utf8")).n_models;
    expect(SITE_STATS.nModels).toBe(declarado);
  });

  it("no source file types the count by hand any more", () => {
    const build = readFileSync(resolve(root, "scripts/build-stats.mjs"), "utf8");
    expect(build).not.toMatch(/nModels\s*=\s*\d/);
    expect(build).toMatch(/modelCount\(/);
  });
});
