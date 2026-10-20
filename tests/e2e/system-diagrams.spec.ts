import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme } from "./helpers";
import { planStats } from "../../lib/plan-data";

test("engineering charts stay contained while resize delivery is delayed", async ({ page, context }) => {
  await blockExternal(context);
  await forceTheme(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          if (!document.documentElement.hasAttribute("data-test-delay-resize")) callback(entries, observer);
        });
      }
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ingenieria/");
  const chart = page.locator("#eda .recharts-wrapper").first();
  await expect.poll(() => chart.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(800);
  await page.evaluate(() => document.documentElement.setAttribute("data-test-delay-resize", ""));
  await page.setViewportSize({ width: 320, height: 900 });
  // Retain a real desktop-sized chart while the observer is delayed. Its data
  // must remain reachable through a local scroller, never widen the document.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  const frame = page.locator("#eda figure > [role=img]").first();
  await expect.poll(() => frame.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await frame.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  expect(await frame.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

for (const lang of ["es", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`system diagrams · ${lang} · ${theme}`, async ({ page, context }) => {
      await blockExternal(context);
      await forceTheme(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${lang === "en" ? "/en" : ""}/ingenieria/`);
      const atlas = page.locator("#sistema");
      await expect(atlas.locator(".system-component")).toHaveCount(9);
      await expect(page.locator("#base-datos .system-entity")).toHaveCount(12);
      // Native disclosures must work with keyboard, without a custom tab widget.
      const summary = atlas.locator("#componente-asistente > summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(atlas.locator("#componente-asistente")).toHaveAttribute("open", "");
      await expect(atlas.locator("#asistente-caption")).toBeVisible();
      await page.evaluate(() => {
        document.querySelectorAll<HTMLDetailsElement>(".system-atlas details").forEach((d) => { d.open = true; });
      });
      const scan = await new AxeBuilder({ page }).include("#sistema").include("#base-datos").analyze();
      expect(scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      for (const width of [320, 375, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        // The page also contains Recharts: ResizeObserver updates their legend
        // after the viewport changes. Assert the settled layout, retaining the
        // same one-pixel tolerance and failing on persistent overflow.
        await expect.poll(
          () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
          { message: `document overflow at ${width}`, timeout: 5000 },
        ).toBe(false);
        if (width < 768) await expect(atlas.locator(".system-mobile-graph").first()).toBeVisible();
      }
      // Plan links to the atlas in its own language and retains its progress.
      await page.goto(`${lang === "en" ? "/en" : ""}/plan/`);
      await expect(page.locator(`a[href="${lang === "en" ? "/en" : ""}/ingenieria/#sistema"]`)).toBeVisible();
      await expect(page.getByRole("img", { name: new RegExp(`${planStats().percent}%`) })).toBeVisible();
    });
  }
}
