// Shared fixtures for the E2E suite (US E3). Everything here is derived from
// the real site contracts: routes come from lib/site-map.ts, the theme is
// forced the same way the site persists it (next-themes → localStorage
// "theme" + class on <html>), and external hosts are blocked so runs are
// hermetic (Plausible, etc. never leave localhost).
import type { Page, BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";

export type ThemeName = "light" | "dark";
export type LangName = "es" | "en";

/** The key routes under test (plan criterion), by base path (ES). */
export const ROUTES = [
  { id: "home", es: "/", en: "/en/" },
  { id: "datos-historicos", es: "/datos-historicos/", en: "/en/datos-historicos/" },
  { id: "resultados", es: "/resultados/", en: "/en/resultados/" },
  { id: "plan", es: "/plan/", en: "/en/plan/" },
  { id: "asistente", es: "/asistente/", en: "/en/asistente/" },
] as const;

export type RouteDef = (typeof ROUTES)[number];

export const routePath = (r: RouteDef, lang: LangName) => (lang === "en" ? r.en : r.es);

/** Viewport width matrix (plan criterion). Height is a plausible browser
 * height for each class of device — the horizontal-overflow assertions do
 * not depend on it. */
export const VIEWPORT_WIDTHS = [320, 375, 480, 768, 1024, 1280, 1536, 1920, 3440] as const;

export const viewportFor = (width: number) => ({
  width,
  height: width < 768 ? 740 : width < 1280 ? 900 : 1000,
});

/** Block every request that leaves the test server (Plausible, any CDN).
 * Keeps runs hermetic and guarantees the suite never triggers the ~150 MB
 * semantic-model download path against a real host. */
export async function blockExternal(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => url.hostname !== "127.0.0.1" && url.hostname !== "localhost",
    (route) => route.abort(),
  );
}

/** Force the theme exactly the way the site persists it: next-themes is
 * mounted with attribute="class" + defaultTheme="system", storing the choice
 * in localStorage("theme"). Setting the key before any script runs plus
 * matching the `prefers-color-scheme` emulation (test.use({ colorScheme }))
 * makes the forcing robust: explicit choice AND system agree. */
export async function forceTheme(page: Page, theme: ThemeName): Promise<void> {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("theme", t);
    } catch {
      /* storage unavailable — colorScheme emulation still applies */
    }
  }, theme);
}

/** Assert the theme actually took (guards against silently testing light
 * twice if next-themes ever changes its persistence contract). */
export async function expectTheme(page: Page, theme: ThemeName): Promise<void> {
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
}

/**
 * Navigate and settle: fonts loaded, then walk the page once (viewport-sized
 * steps) so IO-gated/lazy sections mount and images/charts render, then back
 * to top. The site reveals several sections on intersection — measuring
 * without the walk would skip exactly the content most likely to overflow.
 */
export async function gotoSettled(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight - 100);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(60);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(200);
    window.scrollTo(0, 0);
    await sleep(150);
  });
}

export type OverflowReport = {
  pageOverflowPx: number;
  /** Elements wider than the viewport with no scrollable wrapper (each entry
   * is a short DOM descriptor). Must be empty. */
  unwrappedWide: string[];
};

/**
 * Page-level horizontal overflow + containment of wide regions.
 * - html/body must not scroll horizontally (scrollWidth <= clientWidth + 1).
 * - Any table/pre/svg wider than the viewport must sit inside an ancestor
 *   that actually scrolls (overflow-x auto/scroll) — "wide regions scroll
 *   only inside their wrapper".
 */
export async function overflowReport(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const pageOverflowPx = Math.max(
      doc.scrollWidth - doc.clientWidth,
      body.scrollWidth - body.clientWidth,
      0,
    );

    const descriptor = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className && typeof el.className === "string"
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
        : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    const hasScrollWrapper = (el: Element): boolean => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    };

    const unwrappedWide: string[] = [];
    const wideCandidates = document.querySelectorAll("table, pre, svg, img");
    for (const el of wideCandidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= window.innerWidth + 1) continue; // fits — fine
      if (rect.width === 0 || rect.height === 0) continue; // not rendered
      if (!hasScrollWrapper(el)) unwrappedWide.push(descriptor(el));
    }
    return { pageOverflowPx, unwrappedWide };
  });
}

/** Accessible-name strings the tests need, mirroring lib/i18n.ts verbatim.
 * (The i18n module imports generated content at build time; duplicating the
 * five strings here keeps the suite runnable against out/ alone. If a label
 * changes in lib/i18n.ts these constants fail loudly — update both.) */
export const T = {
  openMenu: { es: "Abrir menú", en: "Open menu" },
  closeMenu: { es: "Cerrar menú", en: "Close menu" },
  onPage: { es: "En esta página", en: "On this page" },
  skip: { es: "Saltar al contenido", en: "Skip to content" },
  semanticEnable: { es: "Activar búsqueda semántica", en: "Enable semantic search" },
} as const;
