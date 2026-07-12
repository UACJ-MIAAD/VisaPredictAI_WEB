// US E3 — responsive matrix: 9 widths × ES/EN × light/dark over the four key
// routes. Two invariants per combination:
//   1. the PAGE never scrolls horizontally (scrollWidth <= clientWidth + 1 on
//      html/body) — the bug class that shipped twice before (fixed 17-jun and
//      6-jul via CDP; this suite makes the check portable);
//   2. any region wider than the viewport (tables, pre, svg, img) scrolls
//      ONLY inside a wrapper with overflow-x auto/scroll.
import { test } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  ROUTES,
  VIEWPORT_WIDTHS,
  viewportFor,
  routePath,
  blockExternal,
  forceTheme,
  expectTheme,
  gotoSettled,
  overflowReport,
  type LangName,
  type ThemeName,
} from "./helpers";

for (const theme of ["light", "dark"] as ThemeName[]) {
  for (const lang of ["es", "en"] as LangName[]) {
    test.describe(`overflow · ${lang} · ${theme}`, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ context, page }) => {
        await blockExternal(context);
        await forceTheme(page, theme);
      });

      for (const route of ROUTES) {
        for (const width of VIEWPORT_WIDTHS) {
          test(`${route.id} @ ${width}px`, async ({ page }) => {
            await page.setViewportSize(viewportFor(width));
            await gotoSettled(page, routePath(route, lang));
            await expectTheme(page, theme);

            const report = await overflowReport(page);
            expect(
              report.pageOverflowPx,
              `horizontal page overflow of ${report.pageOverflowPx}px at ${width}px`,
            ).toBeLessThanOrEqual(1);
            expect(
              report.unwrappedWide,
              "elements wider than the viewport without a scrollable wrapper",
            ).toEqual([]);
          });
        }
      }
    });
  }
}
