import { describe, it, expect } from "vitest";
import { mastheadItems, subnavItems, readingProgress } from "@/lib/nav-model";
import { ROUTES, rShort, sLabel } from "@/lib/site-map";

describe("mastheadItems", () => {
  it("derives every route except home, in site-map order", () => {
    const items = mastheadItems("/", "es");
    expect(items.map((i) => i.path)).toEqual(
      ROUTES.filter((r) => r.path !== "/").map((r) => r.path),
    );
  });

  it("localizes hrefs (/en prefix) without touching the base path", () => {
    const es = mastheadItems("/", "es");
    const en = mastheadItems("/", "en");
    es.forEach((i) => expect(i.href).toBe(i.path));
    en.forEach((i) => expect(i.href).toBe(`/en${i.path}`));
  });

  it("uses the full short-form labels from site-map (never empty)", () => {
    (["es", "en"] as const).forEach((lang) => {
      const items = mastheadItems("/", lang);
      items.forEach((i) => {
        const route = ROUTES.find((r) => r.path === i.path)!;
        expect(i.label).toBe(rShort(route, lang));
        expect(i.label.length).toBeGreaterThan(0);
      });
    });
  });

  it("marks exactly the current route active", () => {
    const items = mastheadItems("/datos-historicos", "es");
    expect(items.filter((i) => i.active).map((i) => i.path)).toEqual([
      "/datos-historicos",
    ]);
  });

  it("marks nothing active on home (the logo is the home link)", () => {
    expect(mastheadItems("/", "es").some((i) => i.active)).toBe(false);
  });
});

describe("subnavItems", () => {
  it("deep-link invariant: ids and order match site-map sections verbatim on every multi-section route", () => {
    for (const r of ROUTES.filter((r) => r.sections.length > 1)) {
      const items = subnavItems(r.path, "es");
      expect(items.map((i) => i.id)).toEqual(r.sections.map((s) => s.id));
      items.forEach((i) => expect(i.href).toBe(`#${i.id}`));
    }
  });

  it("numbers items editorially with two digits (01, 02, …)", () => {
    const items = subnavItems("/", "es");
    expect(items[0].num).toBe("01");
    expect(items[1].num).toBe("02");
    expect(items.at(-1)!.num).toBe(String(items.length).padStart(2, "0"));
  });

  it("returns no subnav for single-section routes (/asistente)", () => {
    expect(subnavItems("/asistente", "es")).toEqual([]);
    expect(subnavItems("/asistente", "en")).toEqual([]);
  });

  it("labels honor the active language", () => {
    const home = ROUTES.find((r) => r.path === "/")!;
    expect(subnavItems("/", "es").map((i) => i.label)).toEqual(
      home.sections.map((s) => sLabel(s, "es")),
    );
    expect(subnavItems("/", "en").map((i) => i.label)).toEqual(
      home.sections.map((s) => sLabel(s, "en")),
    );
  });

  it("falls back to home for unknown paths (routeByPath contract)", () => {
    expect(subnavItems("/nope", "es").map((i) => i.id)).toEqual(
      subnavItems("/", "es").map((i) => i.id),
    );
  });
});

describe("readingProgress", () => {
  it("maps top → 0 and bottom → 100", () => {
    expect(readingProgress(0, 2000, 800)).toBe(0);
    expect(readingProgress(1200, 2000, 800)).toBe(100);
  });

  it("is linear in between", () => {
    expect(readingProgress(600, 2000, 800)).toBeCloseTo(50);
  });

  it("clamps overscroll (iOS rubber-band) to [0, 100]", () => {
    expect(readingProgress(-50, 2000, 800)).toBe(0);
    expect(readingProgress(1300, 2000, 800)).toBe(100);
  });

  it("returns 0 when the page does not scroll (max ≤ 0) or inputs are degenerate", () => {
    expect(readingProgress(0, 800, 800)).toBe(0);
    expect(readingProgress(10, 700, 800)).toBe(0);
    expect(readingProgress(10, NaN, 800)).toBe(0);
  });
});
