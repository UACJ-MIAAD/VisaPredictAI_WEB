// US E3 — keyboard operability of the navigation (minimal header + mobile
// drawer since the 19-nov-2026 redesign; the in-page subnav was removed) and
// the VisaBot console:
//   • skip-link becomes visible on focus and moves focus to #main-content;
//   • mobile drawer: opens from the hamburger, traps focus, Escape closes and
//     returns focus to the trigger;
//   • /asistente: chat textarea and the semantic-consent button are reachable
//     by Tab — WITHOUT activating the ~150 MB model download (belt: we only
//     focus, never Enter; suspenders: external hosts are blocked and any
//     model/rag download attempt recorded and asserted zero).
import { test, expect, type Page } from "@playwright/test";
import {
  blockExternal,
  forceTheme,
  gotoSettled,
  viewportFor,
  T,
} from "./helpers";

/** Press Tab until the chat textarea (.vb-input) holds focus (bounded). */
async function tabToChatInput(page: Page, maxTabs = 120): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(() => {
      const el = document.activeElement;
      return !!el && el.tagName === "TEXTAREA" && el.classList.contains("vb-input");
    });
    if (hit) return true;
  }
  return false;
}

test.describe("keyboard", () => {
  test.use({ colorScheme: "light" });

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await forceTheme(page, "light");
  });

  test("skip-link: visible on focus and functional (ES, desktop)", async ({ page }) => {
    await page.setViewportSize(viewportFor(1280));
    await page.goto("/", { waitUntil: "load" });

    // First Tab lands on the skip link (first focusable in the shell).
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toHaveText(T.skip.es);

    // Visible while focused: its box must be inside the viewport (the resting
    // state hides it above the fold via translateY(-150%); focus-visible slides
    // it in over a 0.15s transition — poll until it lands).
    await expect
      .poll(async () => (await skip.boundingBox())?.y ?? -1, {
        message: "skip-link still hidden above the viewport on focus",
      })
      .toBeGreaterThanOrEqual(0);

    // Functional: Enter moves focus to <main id="main-content" tabindex="-1">.
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
  });

  test("skip-link EN variant", async ({ page }) => {
    await page.setViewportSize(viewportFor(1280));
    await page.goto("/en/", { waitUntil: "load" });
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toHaveText(T.skip.en);
  });

  test("mobile drawer: open, focus inside, Escape closes and restores focus", async ({ page }) => {
    await page.setViewportSize(viewportFor(375));
    await gotoSettled(page, "/");

    const openBtn = page.getByRole("button", { name: T.openMenu.es });
    await expect(openBtn).toBeVisible();
    await openBtn.focus();
    await page.keyboard.press("Enter");
    await expect(openBtn).toHaveAttribute("aria-expanded", "true");

    const drawer = page.getByRole("dialog", { name: "Navegación" });
    await expect(drawer).toBeVisible();

    // Focus moved inside on open (WAI-ARIA dialog pattern).
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const dlg = document.querySelector('aside[role="dialog"]');
          return !!dlg && dlg.contains(document.activeElement);
        }),
      )
      .toBe(true);

    // Focus trap: a full lap of Tab presses never leaves the drawer. The
    // drawer holds the close button + one link per non-home route (7 routes),
    // so 12 presses wraps at least once.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const dlg = document.querySelector('aside[role="dialog"]');
        return !!dlg && dlg.contains(document.activeElement);
      });
      expect(inside, `Tab press #${i + 1} escaped the drawer focus trap`).toBe(true);
    }

    // Escape closes and returns focus to the hamburger.
    await page.keyboard.press("Escape");
    await expect(openBtn).toHaveAttribute("aria-expanded", "false");
    await expect(openBtn).toBeFocused();
  });

  test("asistente: chat + semantic consent reachable by keyboard, download never triggered", async ({ page }) => {
    await page.setViewportSize(viewportFor(1280));

    // Suspenders: record any attempt against the semantic-engine payloads.
    const downloadAttempts: string[] = [];
    page.on("request", (req) => {
      if (/\/models\/|huggingface|onnxruntime|\/ort\//i.test(req.url())) {
        downloadAttempts.push(req.url());
      }
    });

    await gotoSettled(page, "/asistente/");

    // Tab to the chat textarea (the console's message input).
    const reachedInput = await tabToChatInput(page);
    expect(reachedInput, "chat textarea unreachable by Tab").toBe(true);

    // The consent button must be focusable (operable) — we FOCUS it but never
    // activate it (plan: do not start the ~150 MB download).
    const consent = page.getByRole("button", { name: T.semanticEnable.es });
    await expect(consent).toBeVisible();
    await consent.focus();
    await expect(consent).toBeFocused();

    expect(
      downloadAttempts,
      "the suite must never trigger the semantic model download",
    ).toEqual([]);
  });
});
