import { describe, it, expect } from "vitest";
import { localeOf } from "@/lib/i18n";

describe("localeOf", () => {
  it("maps en → en-US", () => {
    expect(localeOf("en")).toBe("en-US");
  });

  it("maps es → es-MX", () => {
    expect(localeOf("es")).toBe("es-MX");
  });

  it("defaults any other string to es-MX (Spanish is the source language)", () => {
    expect(localeOf("fr")).toBe("es-MX");
    expect(localeOf("")).toBe("es-MX");
  });
});
