import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sources = JSON.parse(readFileSync("app/fonts/sources.json", "utf8")) as {
  files: { sha256: string }[];
};

async function loadPrimaryFonts(page: Page): Promise<boolean[]> {
  return page.evaluate(async () => {
    const style = getComputedStyle(document.body);
    const result: boolean[] = [];
    for (const [variable, weights] of [
      ["--font-playfair", [700, 800, 900]],
      ["--font-dm", [400, 500, 600, 700]],
      ["--font-space-mono", [400, 700]],
    ] as const) {
      // FontFaceSet.load also loads named fallback faces in a family list.
      // Those optional system fonts may be absent on Linux; require the
      // shipped primary face itself, so a fallback cannot hide a broken WOFF2.
      const family = style.getPropertyValue(variable).split(",")[0].trim();
      for (const weight of weights) {
        const faces = await document.fonts.load(
          `${weight} 24px ${family}`,
          "Árbol, año, pingüino, acción y €, C/F/U",
        );
        result.push(faces.length > 0 && faces.every((face) => face.status === "loaded"));
      }
    }
    return result;
  });
}

for (const locale of ["es", "en"]) {
  test(`site fonts load locally with Spanish glyphs · ${locale}`, async ({ page }) => {
    const googleRequests: string[] = [];
    const fontBodies: Promise<string>[] = [];
    page.on("request", (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) {
        googleRequests.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (/\/_next\/static\/media\/.*\.woff2$/.test(response.url())) {
        fontBodies.push(response.body().then((body) => createHash("sha256").update(body).digest("hex")));
      }
    });
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await page.goto(locale === "es" ? "/" : "/en/");
    const loaded = await loadPrimaryFonts(page);
    expect(loaded).toEqual(Array(9).fill(true));
    expect(googleRequests).toEqual([]);
    const hashes = await Promise.all(fontBodies);
    for (const source of sources.files) expect(hashes).toContain(source.sha256);
  });
}

test("a missing primary WOFF2 cannot pass through a fallback", async ({ page }) => {
  const blocked: string[] = [];
  await page.route(/\/_next\/static\/media\/.*\.woff2$/, (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });
  await page.goto("/");
  await expect(loadPrimaryFonts(page)).rejects.toThrow(/NetworkError/);
  expect(blocked.length).toBeGreaterThan(0);
});
