import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sources = JSON.parse(readFileSync("app/fonts/sources.json", "utf8")) as {
  files: { sha256: string }[];
};

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
    const loaded = await page.evaluate(async () => {
      const style = getComputedStyle(document.body);
      const result: boolean[] = [];
      for (const [variable, weights] of [
        ["--font-playfair", [700, 800, 900]],
        ["--font-dm", [400, 500, 600, 700]],
        ["--font-space-mono", [400, 700]],
      ] as const) {
        const family = style.getPropertyValue(variable).trim();
        for (const weight of weights) {
          const font = `${weight} 24px ${family}`;
          const faces = await document.fonts.load(font, "Árbol, año, pingüino, acción y €, C/F/U");
          result.push(faces.length > 0 && faces.every((face) => face.status === "loaded"));
        }
      }
      return result;
    });
    expect(loaded).toEqual(Array(9).fill(true));
    expect(googleRequests).toEqual([]);
    const hashes = await Promise.all(fontBodies);
    for (const source of sources.files) expect(hashes).toContain(source.sha256);
  });
}
