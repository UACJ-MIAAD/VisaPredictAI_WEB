// Audit round 2: a renamed /data asset would 404 in prod (and the miss is
// CDN-cacheable for 1h) — nothing tied the hardcoded fetch literals to files.
// This walks every "/data/..." string literal in source and asserts the
// committed fallback exists in public/.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "node:fs";

const ROOT = process.cwd();
const SOURCE_GLOBS = ["lib/**/*.ts", "components/**/*.tsx", "components/**/*.ts"];

function dataLiterals(): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const pattern of SOURCE_GLOBS) {
    for (const file of globSync(pattern, { cwd: ROOT })) {
      if (file.includes(".generated.")) continue;
      const src = readFileSync(join(ROOT, file), "utf8");
      for (const m of src.matchAll(/["'`](\/data\/[A-Za-z0-9_\-./]+\.[a-z0-9]+)["'`]/g)) {
        const list = hits.get(m[1]) ?? [];
        list.push(file);
        hits.set(m[1], list);
      }
    }
  }
  return hits;
}

// F2 · El feed de ingesta se consume ANTES de que el corte lo publique: su ausencia es el
// estado `absent`, que el banner trata explícitamente. Comprometer un respaldo aquí sería
// teclear en este repositorio el bloqueo que el pipeline debe registrar — justo lo que F2
// evita. La excepción es nominal, y caduca sola: en cuanto el artefacto exista, exigir su
// respaldo vuelve a ser lo correcto y esta lista debe quedar vacía.
const SIN_RESPALDO_TODAVIA = new Map([
  ["/data/ingestion_state.json", "F2: el corte publicado aún no lo trae; el consumidor lo trata como `absent`"],
]);

describe("every hardcoded /data/* literal has a committed fallback", () => {
  const hits = dataLiterals();
  it("finds the known consumers (sanity: the scan itself works)", () => {
    expect(hits.size).toBeGreaterThanOrEqual(5); // panel csv, facts, forecasts...
  });
  for (const [path, files] of dataLiterals()) {
    const exento = SIN_RESPALDO_TODAVIA.get(path);
    it(`${path} (used by ${files[0]})${exento ? " — exento" : ""}`, () => {
      if (exento) {
        // La exención NO puede sobrevivir al artefacto: si el respaldo ya existe, sobra.
        expect(existsSync(join(ROOT, "public", path)), `${path}: ya hay respaldo, retira la exención (${exento})`).toBe(false);
        return;
      }
      expect(existsSync(join(ROOT, "public", path))).toBe(true);
    });
  }
  it("every declared exception corresponds to a literal that really exists in source", () => {
    for (const path of SIN_RESPALDO_TODAVIA.keys()) {
      expect(hits.has(path), `${path}: exención sin consumidor — retírala`).toBe(true);
    }
  });
});
