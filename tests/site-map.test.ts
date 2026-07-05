import { describe, it, expect } from "vitest";
import { basePath, localePath } from "@/lib/site-map";

describe("localePath", () => {
  it("leaves Spanish paths untouched", () => {
    expect(localePath("/", "es")).toBe("/");
    expect(localePath("/datos-historicos", "es")).toBe("/datos-historicos");
  });

  it("prefixes English paths with /en (root → /en, not /en/)", () => {
    expect(localePath("/", "en")).toBe("/en");
    expect(localePath("/datos-historicos", "en")).toBe("/en/datos-historicos");
  });
});

describe("basePath", () => {
  it("normalizes the root in both locales", () => {
    expect(basePath("/")).toBe("/");
    expect(basePath("/en")).toBe("/");
    expect(basePath("/en/")).toBe("/");
  });

  it("strips the /en prefix from sub-routes", () => {
    expect(basePath("/en/datos-historicos")).toBe("/datos-historicos");
    expect(basePath("/en/datos-historicos/")).toBe("/datos-historicos");
  });

  it("strips trailing slashes on Spanish routes", () => {
    expect(basePath("/datos-historicos/")).toBe("/datos-historicos");
  });

  it("does NOT eat routes that merely start with 'en'", () => {
    expect(basePath("/encuesta")).toBe("/encuesta");
    expect(basePath("/entrada/")).toBe("/entrada");
  });

  it("degrades empty input to the root", () => {
    expect(basePath("")).toBe("/");
  });
});
