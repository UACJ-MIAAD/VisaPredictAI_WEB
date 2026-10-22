import { describe, expect, it } from "vitest";
import { buildBM25, retrieveRanked, tokenize } from "@/lib/visabot/retrieval-core.mjs";

describe("administrative status codes remain retrieval terms", () => {
  it("retains C/F/U as distinct domain terms", () => {
    expect(tokenize("C, F y U; UNK")).toEqual(["c", "f", "u", "unk"]);
  });

  it("still drops arbitrary single-letter noise and stopwords", () => {
    expect(tokenize("a b x y z")).toEqual([]);
  });

  for (const lang of ["es", "en"] as const) {
    const chunks = ["F", "C", "U"].map((code) => ({
      lang,
      kind: "glossary",
      title: lang === "es" ? `Estado ${code}` : `Status ${code}`,
      text: lang === "es" ? `Código administrativo del boletín: ${code}.` : `Administrative bulletin code: ${code}.`,
    }));
    const vectors = new Float32Array([1, 0, 0.98, 0.2, 0.96, 0.28]);
    const bm25 = buildBM25(chunks);

    for (const code of ["C", "U"]) {
      it(`retrieves ${code}, rather than another status, with lexical search in ${lang}`, () => {
        const query = lang === "es" ? `¿Qué significa el estado ${code}?` : `What does status ${code} mean?`;
        const result = retrieveRanked({ chunks, vectors, dim: 2, bm25, query, qv: null, lang, k: 1 });
        expect(chunks[result.selected[0]]?.title).toBe(lang === "es" ? `Estado ${code}` : `Status ${code}`);
      });

      it(`retains the exact ${code} signal with a dense preference for F in ${lang}`, () => {
        const query = lang === "es" ? `¿Qué significa el estado ${code}?` : `What does status ${code} mean?`;
        const result = retrieveRanked({ chunks, vectors, dim: 2, bm25, query, qv: new Float32Array([1, 0]), lang, k: 1 });
        expect(chunks[result.selected[0]]?.title).toBe(lang === "es" ? `Estado ${code}` : `Status ${code}`);
      });
    }
  }

  it("keeps category-code normalization distinct from a standalone F status", () => {
    expect(tokenize("F 4, F2-A y F")).toEqual(["f4", "f2a", "f"]);
  });

  it("does not alter category-code spelling controls", () => {
    expect(tokenize("F 4 y F2-A")).toEqual(["f4", "f2a"]);
    expect(tokenize("EB-2, EB 5")).toEqual(["eb2", "eb5"]);
  });
});
