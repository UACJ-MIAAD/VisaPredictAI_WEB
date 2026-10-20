import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme } from "./helpers";
import { planStats } from "../../lib/plan-data";

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
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `document overflow at ${width}`).toBe(false);
        if (width < 768) await expect(atlas.locator(".system-mobile-graph").first()).toBeVisible();
      }
      // Plan links to the atlas in its own language and retains its progress.
      await page.goto(`${lang === "en" ? "/en" : ""}/plan/`);
      await expect(page.locator(`a[href="${lang === "en" ? "/en" : ""}/ingenieria/#sistema"]`)).toBeVisible();
      await expect(page.getByRole("img", { name: new RegExp(`${planStats().percent}%`) })).toBeVisible();
    });
  }
}
