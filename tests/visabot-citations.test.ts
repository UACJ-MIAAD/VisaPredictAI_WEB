import { describe, expect, it } from "vitest";
import { renumberCitations } from "../components/visabot/citations";

const src = (n: number) => ({ n, title: `t${n}`, source: `s${n}`, text: "", url: `#${n}` });

describe("renumberCitations", () => {
  it("renumbers the cited sources in reading order and drops the uncited", () => {
    const r = renumberCitations("A [9]. B [3] and [9]. C [12].", [src(3), src(5), src(9), src(12)]);
    expect(r.content).toBe("A [1]. B [2] and [1]. C [3].");
    expect(r.sources.map((s) => [s.n, s.title])).toEqual([[1, "t9"], [2, "t3"], [3, "t12"]]);
  });
  it("leaves bracketed numbers that are not sources untouched", () => {
    const r = renumberCitations("Range [80] and [9].", [src(9)]);
    expect(r.content).toBe("Range [80] and [1].");
  });
  it("handles no sources", () => {
    expect(renumberCitations("x [1]", undefined)).toEqual({ content: "x [1]", sources: [] });
  });
});
