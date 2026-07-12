// B3: contratos cross-repo del lado consumidor — los fallbacks commiteados validan
// contra los contratos vendorizados (la prueba conjunta OFFLINE, sin GitHub raw ni
// Netlify), la validación caza payloads rotos y la deriva de contrato se detecta.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { outFor, validateArtifact, vendoredMatches } from "../lib/release.mjs";

const CONTRACTS = join(process.cwd(), "lib", "contracts");
const DATA = join(process.cwd(), "public", "data");

const vendored = readdirSync(CONTRACTS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ name: f, buf: readFileSync(join(CONTRACTS, f)), contract: JSON.parse(readFileSync(join(CONTRACTS, f), "utf8")) }));

describe("contratos vendorizados vs fallbacks commiteados (prueba conjunta offline)", () => {
  it("hay 14 contratos vendorizados y todos declaran artifact + kind", () => {
    expect(vendored.length).toBe(14);
    for (const v of vendored) {
      expect(v.contract.contract_version).toBe(1);
      expect(typeof v.contract.artifact).toBe("string");
      expect(["csv", "json"]).toContain(v.contract.kind);
    }
  });

  it("cada fallback presente en public/data cumple su contrato", () => {
    let checked = 0;
    for (const v of vendored) {
      const out = outFor(v.contract.artifact);
      if (!out) continue; // artefacto no consumido en public/data (ledgers, key_facts…)
      const local = join(DATA, out);
      if (!existsSync(local)) continue; // sin fallback commiteado — nada que probar offline
      expect(validateArtifact(v.contract, readFileSync(local)), `${out} viola ${v.name}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4); // panel, forecasts, meta, scorecard al menos
  });
});

describe("validateArtifact", () => {
  const csv = { kind: "csv", required_columns: ["a", "b"] };
  it("csv: header completo pasa; columna ausente falla", () => {
    expect(validateArtifact(csv, Buffer.from("a,b,c\n1,2,3\n"))).toBe(true);
    expect(validateArtifact(csv, Buffer.from("a,c\n1,3\n"))).toMatch(/ausentes: b/);
  });
  const js = { kind: "json", required_keys: { v: "str", n: "int", items: "list" } };
  it("json: llaves y tipos correctos pasan; faltantes o mal tipados fallan", () => {
    expect(validateArtifact(js, Buffer.from(JSON.stringify({ v: "x", n: 2, items: [] })))).toBe(true);
    expect(validateArtifact(js, Buffer.from(JSON.stringify({ v: "x", items: [] })))).toMatch(/ausente: n/);
    expect(validateArtifact(js, Buffer.from(JSON.stringify({ v: "x", n: 2.5, items: [] })))).toMatch(/'n' debería ser int/);
    expect(validateArtifact(js, Buffer.from("{roto"))).toMatch(/JSON ilegible/);
  });
});

describe("deriva de contrato (vendored vs publicado)", () => {
  it("mapea vp_data/contracts/* a contracts/* y detecta el mismatch por hash", () => {
    expect(outFor("vp_data/contracts/eda_facts.json")).toBe("contracts/eda_facts.json");
    const buf = Buffer.from("contrato");
    const entry = { out: "contracts/x.json", sha256: createHash("sha256").update(buf).digest("hex") };
    expect(vendoredMatches(entry, buf)).toBe(true);
    expect(vendoredMatches(entry, Buffer.from("otro"))).toBe(false);
    expect(vendoredMatches(entry, undefined)).toBe(false);
  });
});
