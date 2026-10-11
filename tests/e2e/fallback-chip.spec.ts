// The "in-browser baseline" chip only renders when a series has no production
// forecast (`spec.fallback`), so the route sweep in a11y.spec.ts never reaches
// it: its ochre text on its own ochre tint sat below AA (4.26:1 light) unseen.
// This drives #pronostico to such a series and runs axe on the section in both
// themes. If the series ever gains a production forecast the chip assertion
// fails loudly — pick another series without one; do not drop the test.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  ROUTES,
  routePath,
  viewportFor,
  blockExternal,
  forceTheme,
  expectTheme,
  gotoSettled,
  type LangName,
  type ThemeName,
} from "./helpers";

const ROUTE = ROUTES.find((r) => r.id === "datos-historicos")!;
// Has F observations through the latest cut but no row in forecasts.csv.
const SERIES = { country: "china", category: "EB5_UNRESERVED", table: "FAD" };
const LABELS = {
  es: { country: "País / área de cargabilidad", category: "Categoría", table: "Tabla", chip: "línea base en el navegador" },
  en: { country: "Country / chargeability area", category: "Category", table: "Table", chip: "in-browser baseline" },
};

for (const theme of ["light", "dark"] as ThemeName[]) {
  for (const lang of ["es", "en"] as LangName[]) {
    test.describe(`fallback chip · ${lang} · ${theme}`, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ context, page }) => {
        await blockExternal(context);
        await forceTheme(page, theme);
      });

      test("axe on #pronostico with the in-browser baseline", async ({ page }) => {
        await page.setViewportSize(viewportFor(1280));
        // No #pronostico in the URL: the page re-anchors a hash after load and
        // gotoSettled waits for scrollY 0. Its walk already mounts the section.
        await gotoSettled(page, routePath(ROUTE, lang));
        await expectTheme(page, theme);

        const section = page.locator("#pronostico");
        await section.scrollIntoViewIfNeeded();
        const l = LABELS[lang];
        await section.getByRole("combobox", { name: l.country, exact: true }).selectOption(SERIES.country);
        await section.getByRole("combobox", { name: l.category, exact: true }).selectOption(SERIES.category);
        await section.getByRole("combobox", { name: l.table, exact: true }).selectOption(SERIES.table);

        const chip = section.getByText(l.chip, { exact: true });
        await expect(chip).toBeVisible();

        const results = await new AxeBuilder({ page }).include("#pronostico").analyze();
        const gating = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        const brief = gating.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
        }));
        expect(brief, `axe serious/critical on #pronostico with fallback (${lang}, ${theme})`).toEqual([]);
      });
    });
  }
}
