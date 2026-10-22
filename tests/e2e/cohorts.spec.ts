// E5 — the stability-cohort section on /ingenieria: visible in ES and EN with the numbers of
// the served e5_facts.json, no serious/critical axe findings inside it, and no horizontal
// overflow at phone or desktop width, in both themes. /ingenieria is outside the shared ROUTES
// matrix, so the section carries its own sweep.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme, expectTheme, gotoSettled, viewportFor, type LangName, type ThemeName } from "./helpers";

const E5 = JSON.parse(readFileSync(join(process.cwd(), "public", "data", "e5_facts.json"), "utf8"));
const PATH: Record<LangName, string> = { es: "/ingenieria/", en: "/en/ingenieria/" };
const HEADING: Record<LangName, RegExp> = { es: /estables y no estables/, en: /stable and unstable/ };

for (const theme of ["light", "dark"] as ThemeName[]) {
  for (const lang of ["es", "en"] as LangName[]) {
    test.describe(`cohorts · ${lang} · ${theme}`, () => {
      test.use({ colorScheme: theme });
      test.beforeEach(async ({ context, page }) => {
        await blockExternal(context);
        await forceTheme(page, theme);
      });

      for (const width of [375, 1280]) {
        test(`${width}px`, async ({ page }) => {
          await page.setViewportSize(viewportFor(width));
          await gotoSettled(page, PATH[lang]);
          await expectTheme(page, theme);

          const section = page.locator("section#cohortes");
          await section.scrollIntoViewIfNeeded();
          await expect(section.getByRole("heading", { level: 2 })).toHaveText(HEADING[lang]);
          for (const n of [E5.NSeriesEvaluable, E5.NEstable, E5.NNoEstable]) {
            await expect(section.getByText(String(n), { exact: true }).first()).toBeVisible();
          }

          const overflow = await page.evaluate(() => {
            const el = document.querySelector("section#cohortes")!;
            return { doc: document.documentElement.scrollWidth - window.innerWidth, sec: el.scrollWidth - el.clientWidth };
          });
          expect(overflow, `horizontal overflow at ${width}px`).toEqual({ doc: 0, sec: 0 });

          const results = await new AxeBuilder({ page }).include("section#cohortes").analyze();
          const gating = results.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) }));
          expect(gating, `axe serious/critical in #cohortes (${lang}, ${theme})`).toEqual([]);
        });
      }
    });
  }
}
