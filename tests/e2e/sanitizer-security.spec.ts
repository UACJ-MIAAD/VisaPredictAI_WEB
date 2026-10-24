import { test, expect } from "@playwright/test";
import type { DOMPurify } from "dompurify";

// Exercise the actual installed browser library. These IN_PLACE controls cover
// upstream GHSA-mrv2-3pqr-j5jr; the app itself uses string sanitization, no hooks.
for (const removal of ["current", "ancestor", "following"] as const) {
  test(`sanitizer neutralizes handlers after hook removal · ${removal}`, async ({ page }) => {
    await page.goto("about:blank");
    await page.addScriptTag({ path: "node_modules/dompurify/dist/purify.min.js" });
    const handler = await page.evaluate((mode) => {
      const purifier = (window as unknown as { DOMPurify: DOMPurify }).DOMPurify;
      const container = document.createElement("section");
      container.innerHTML = '<article><img data-drop="yes"><img data-unsafe="yes" onerror="void(1)"></article><p>Texto válido</p>';
      document.body.append(container);
      const unsafe = container.querySelector("[data-unsafe]")!;
      purifier.addHook("afterSanitizeAttributes", (node) => {
        if (node.getAttribute("data-drop") !== "yes") return;
        if (mode === "ancestor") node.parentElement?.remove();
        else if (mode === "following") node.nextElementSibling?.remove();
        else node.remove();
      });
      purifier.sanitize(container, { IN_PLACE: true });
      return unsafe.getAttribute("onerror");
    }, removal);
    expect(handler).toBeNull();
  });
}

test("sanitizer retains benign Spanish prose and links", async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ path: "node_modules/dompurify/dist/purify.min.js" });
  const clean = await page.evaluate(() => {
    const purifier = (window as unknown as { DOMPurify: DOMPurify }).DOMPurify;
    return purifier.sanitize('<p>Acción <strong>F2A</strong>: <a href="https://travel.state.gov/">boletín</a></p>');
  });
  expect(clean).toBe('<p>Acción <strong>F2A</strong>: <a href="https://travel.state.gov/">boletín</a></p>');
});
