// US E3 — axe-core sweep: 0 serious/critical violations on the four key
// routes × {ES, EN} × {light, dark}. Moderate/minor findings do not gate
// (plan criterion is serious/critical). No exclusions: the three contrast
// findings this sweep originally surfaced (subnav digits, VisaBot launcher in
// dark, the #contacto deep band in dark) were fixed on 2026-07-12 — see the
// git history of site-nav.tsx, visabot.tsx and content.css/globals.css.
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

for (const theme of ["light", "dark"] as ThemeName[]) {
  for (const lang of ["es", "en"] as LangName[]) {
    test.describe(`axe · ${lang} · ${theme}`, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ context, page }) => {
        await blockExternal(context);
        await forceTheme(page, theme);
      });

      for (const route of ROUTES) {
        test(`${route.id}`, async ({ page }) => {
          await page.setViewportSize(viewportFor(1280));
          await gotoSettled(page, routePath(route, lang));
          await expectTheme(page, theme);

          const results = await new AxeBuilder({ page }).analyze();

          const gating = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          );
          const brief = gating.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
          }));
          expect(
            brief,
            `axe serious/critical violations on ${routePath(route, lang)} (${theme})`,
          ).toEqual([]);
        });
      }
    });
  }
}
