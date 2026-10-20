import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme } from "./helpers";
import { planStats } from "../../lib/plan-data";

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const layout = await page.evaluate(() => {
    const describe = (el: Element) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName, id: el.id, className: el.getAttribute("class"),
        text: el.textContent?.trim().slice(0, 120), rect: rect.toJSON(),
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
        font: style.font, overflowX: style.overflowX,
        visibility: style.visibility, position: style.position, transform: style.transform,
      };
    };
    const elements = [...document.querySelectorAll("body *")];
    const wide = elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1 || el.scrollWidth > el.clientWidth + 1);
    }).map((el) => {
      const ancestors = [];
      for (let parent = el.parentElement; parent; parent = parent.parentElement) ancestors.push(describe(parent));
      return { element: describe(el), ancestors };
    });
    const pseudos = [document.documentElement, ...elements].flatMap((el) =>
      ["::before", "::after"].flatMap((pseudo) => {
        const style = getComputedStyle(el, pseudo);
        return style.content === "none" || style.content === "normal" ? [] : [{
          owner: describe(el), pseudo, content: style.content, position: style.position,
          width: style.width, left: style.left, right: style.right, transform: style.transform,
        }];
      }),
    );
    return {
      url: location.href, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      scroll: { x: scrollX, y: scrollY }, root: describe(document.documentElement), body: describe(document.body),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      fonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      wide, pseudos,
    };
  });
  await info.attach("layout-diagnostics", { body: JSON.stringify(layout, null, 2), contentType: "application/json" });
  const uncontained = layout.wide.filter(({ ancestors }) =>
    !ancestors.some((ancestor) => ["auto", "scroll", "hidden", "clip"].includes(ancestor.overflowX)),
  );
  console.log("LAYOUT_DIAGNOSTICS", JSON.stringify({ root: layout.root, viewport: layout.viewport, uncontained: uncontained.slice(0, 30), pseudos: layout.pseudos }));
});

for (const lang of ["es", "en"] as const) {
  test(`engineering metrics contain wider font metrics · ${lang}`, async ({ page, context }) => {
    await blockExternal(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`${lang === "en" ? "/en" : ""}/ingenieria/`);
    // Exercise intrinsic track sizing with a deterministic wider font. The
    // remote failure identified the real ruff+mypy metric, not the diagrams.
    await page.addStyleTag({ content: ".metric-num { font-family: monospace !important; }" });
    const metric = page.locator("#mlops .metric").filter({ hasText: "ruff+mypy" });
    await expect(metric).toHaveCount(1);
    await metric.scrollIntoViewIfNeeded();
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => metric.evaluate((el) => {
        const grid = el.closest(".metrics-inner")!;
        return el.getBoundingClientRect().right <= grid.getBoundingClientRect().right + 1
          && el.scrollWidth <= el.clientWidth + 1;
      })).toBe(true);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await expect(metric.locator(".metric-num")).toHaveText("ruff+mypy");
    }
  });
}

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
