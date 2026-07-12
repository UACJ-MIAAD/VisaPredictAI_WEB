// US E3 — visual regression captures: 4 routes × {375, 1280} × {light, dark},
// ES. Deliberately ARTIFACTS, not compared snapshots: the suite runs on
// macOS locally and Linux in CI, and cross-platform font rasterization makes
// pixel-diff baselines permanently flaky — the plan allows either and asks
// for "lo estable en CI". CI uploads e2e-screenshots/ on every run
// (actions/upload-artifact, see .github/workflows/ci.yml `e2e` job), so any
// regression is reviewable against the previous run's artifact.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import {
  ROUTES,
  routePath,
  viewportFor,
  blockExternal,
  forceTheme,
  expectTheme,
  gotoSettled,
  type ThemeName,
} from "./helpers";

const OUT_DIR = path.resolve(process.cwd(), "e2e-screenshots");

for (const theme of ["light", "dark"] as ThemeName[]) {
  test.describe(`screenshots · ${theme}`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ context, page }) => {
      await blockExternal(context);
      await forceTheme(page, theme);
    });

    for (const route of ROUTES) {
      for (const width of [375, 1280]) {
        test(`${route.id} @ ${width}px`, async ({ page }) => {
          await page.setViewportSize(viewportFor(width));
          await gotoSettled(page, routePath(route, "es"));
          await expectTheme(page, theme);
          // Freeze motion so captures are comparable across runs.
          await page.addStyleTag({
            content:
              "*, *::before, *::after { animation: none !important; transition: none !important; }",
          });
          mkdirSync(OUT_DIR, { recursive: true });
          await page.screenshot({
            path: path.join(OUT_DIR, `${route.id}-${width}-${theme}.png`),
            fullPage: true,
          });
        });
      }
    }
  });
}
