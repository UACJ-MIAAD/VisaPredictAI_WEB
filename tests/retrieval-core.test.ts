import { describe, it, expect } from "vitest";
import { tokenize, idxText, buildBM25, bm25Rank, expandQuery, detectQueryLang, retrieveRanked } from "@/lib/visabot/retrieval-core.mjs";

describe("tokenize (shared retrieval core)", () => {
  it("folds every spelling of a category code to one token (findings 2, 7)", () => {
    for (const s of ["EB-5", "EB 5", "EB.5", "EB5", "eb-5"]) expect(tokenize(s)).toContain("eb5");
    for (const s of ["F2A", "F2-A", "F2 A"]) expect(tokenize(s)).toContain("f2a");
    expect(tokenize("F 4 visa")).toContain("f4");
  });

  it("distinguishes EB2 from EB5 (both collapsed to 'eb' before the fix)", () => {
    expect(tokenize("india EB-2")).toContain("eb2");
    expect(tokenize("india EB-2")).not.toContain("eb5");
  });

  it("does not glue a code onto the next A/B-initial word (regression)", () => {
    // "f1 backlog" must stay two tokens, not "f1backlog"
    expect(tokenize("F1 backlog")).toEqual(["f1", "backlog"]);
    expect(tokenize("EB2 based")).toEqual(["eb2", "based"]);
    expect(tokenize("F2 A dates")).toContain("f2a"); // real suffix still folds
  });

  it("folds accents and drops bilingual stopwords", () => {
    expect(tokenize("¿Qué es México?")).toEqual(["mexico"]);
  });
});

describe("idxText (embedCtx single-source — findings 12, 23)", () => {
  it("prefixes the structural embedCtx so BM25 matches engine + all evals", () => {
    expect(idxText({ embedCtx: "Marco metodológico", title: "CRISP-DM", text: "seis fases" })).toBe("Marco metodológico CRISP-DM seis fases");
  });
  it("omits the prefix when a chunk has no embedCtx", () => {
    expect(idxText({ title: "x", text: "y" })).toBe("x y");
  });
});

describe("BM25 ranking", () => {
  it("ranks the chunk carrying the query terms first", () => {
    const chunks = [
      { title: "a", text: "dates for filing calendar" },
      { title: "b", text: "final action dates adjudication" },
    ];
    const L = buildBM25(chunks);
    const ranked = bm25Rank(L, tokenize("dates for filing"), [0, 1]);
    expect(ranked[0].i).toBe(0);
  });
});

describe("expandQuery (phrase → acronym, stopword-aware)", () => {
  it("adds the acronym when the full phrase (minus stopwords) is present", () => {
    expect(expandQuery(tokenize("final action dates"))).toContain("fad");
    expect(expandQuery(tokenize("dates for filing"))).toContain("dff"); // 'for' is a stopword
    expect(expandQuery(tokenize("model confidence set"))).toContain("mcs");
  });
  it("does not fabricate acronyms from a partial phrase", () => {
    expect(expandQuery(tokenize("final dates"))).not.toContain("fad");
  });
});

describe("detectQueryLang", () => {
  it("flags Spanish by diacritics/function words and English otherwise", () => {
    expect(detectQueryLang("¿qué es FAD?")).toBe("es");
    expect(detectQueryLang("cual es el mejor modelo")).toBe("es");
    expect(detectQueryLang("which model wins")).toBe("en");
  });
  it("does not misfire to Spanish on English with homograph words (son/los/con)", () => {
    expect(detectQueryLang("the son of a US citizen")).toBe("en");
    expect(detectQueryLang("wait for the Los Angeles office")).toBe("en");
    expect(detectQueryLang("pros and cons of EB2")).toBe("en");
  });
});

describe("retrieveRanked (full pipeline)", () => {
  const chunks = [
    { id: "0", lang: "es", kind: "glossary", title: "Final Action Dates", text: "fecha que autoriza la adjudicación" },
    { id: "1", lang: "es", kind: "academic", title: "Metodología", text: "el pipeline procesa el panel" },
    { id: "2", lang: "en", kind: "glossary", title: "Dates for Filing", text: "start the filing early" },
  ];
  const dim = 2;
  const vectors = new Float32Array([1, 0, 0, 1, 0.7, 0.7]); // arbitrary, L2-ish
  const bm25 = buildBM25(chunks);

  it("BM25-only: the title-matching chunk wins via the reranker", () => {
    const { selected } = retrieveRanked({ chunks, vectors, dim, bm25, query: "qué es Final Action Dates", qv: null, lang: "es", k: 2 });
    expect(selected[0]).toBe(0);
  });

  it("empty/stopword-only query falls back to glossary/fact instead of nothing", () => {
    const { selected } = retrieveRanked({ chunks, vectors, dim, bm25, query: "de la el", qv: null, lang: "es", k: 2 });
    expect(selected.length).toBeGreaterThan(0);
    expect(chunks[selected[0]].kind).toBe("glossary");
  });
});
