import { describe, it, expect } from "vitest";
import { mastheadItems, secondaryItems, PRIMARY_PATHS } from "@/lib/nav-model";
import { ROUTES, rShort } from "@/lib/site-map";

describe("mastheadItems", () => {
  it("lists exactly the primary routes, in order, and every one exists in the site map", () => {
    const items = mastheadItems("/", "es");
    expect(items.map((i) => i.path)).toEqual([...PRIMARY_PATHS]);
    items.forEach((i) => expect(ROUTES.some((r) => r.path === i.path)).toBe(true));
  });

  it("localizes hrefs (/en prefix) without touching the base path", () => {
    mastheadItems("/", "es").forEach((i) => expect(i.href).toBe(i.path));
    mastheadItems("/", "en").forEach((i) => expect(i.href).toBe(`/en${i.path}`));
  });

  it("uses the short labels from the site map", () => {
    (["es", "en"] as const).forEach((lang) =>
      mastheadItems("/", lang).forEach((i) => {
        expect(i.label).toBe(rShort(ROUTES.find((r) => r.path === i.path)!, lang));
        expect(i.label.length).toBeGreaterThan(0);
      }),
    );
  });

  it("marks exactly the current route active, and nothing on home", () => {
    expect(mastheadItems("/datos-historicos", "es").filter((i) => i.active).map((i) => i.path)).toEqual(["/datos-historicos"]);
    expect(mastheadItems("/", "es").some((i) => i.active)).toBe(false);
  });
});

describe("secondaryItems", () => {
  it("together with the header, reaches every non-home route exactly once", () => {
    const all = [...mastheadItems("/", "es"), ...secondaryItems("/", "es")].map((i) => i.path).sort();
    expect(all).toEqual(ROUTES.filter((r) => r.path !== "/").map((r) => r.path).sort());
  });
});
