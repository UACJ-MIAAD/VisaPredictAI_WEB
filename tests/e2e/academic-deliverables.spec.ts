import { test, expect } from "@playwright/test";
import { blockExternal } from "./helpers";
import { createHash } from "node:crypto";
import manifest from "../../public/entregables/2026-10-30/manifest.json";

for (const lang of ["es", "en"] as const) {
  test(`academic review PDFs · ${lang}`, async ({ page, context, request }) => {
    await blockExternal(context);
    await page.goto(lang === "es" ? "/plan/" : "/en/plan/");
    const section = page.locator("#entregables");
    await expect(section.locator("li")).toHaveCount(8);
    await expect(section.locator("a")).toHaveCount(7);
    await expect(section.locator('a[href^="/entregables/2026-10-24/"]')).toHaveCount(0);
    await expect(section.locator('a[href^="/entregables/2026-10-25/"]')).toHaveCount(0);
    await expect(section).toContainText(lang === "es" ? "se compila y verifica en local" : "compiled and verified locally");
    const c1 = section.locator("li").filter({ has: page.getByRole("heading", { name: /^C1 ·/ }) });
    await expect(c1.locator("a")).toHaveCount(0);
    await expect(c1).toContainText(lang === "es" ? "Pendiente de un evento real" : "Awaiting a real event");
    for (const artifact of manifest.artifacts) {
      expect(artifact.pages).toBe(({ A11: 90, A12: 91, A13: 94, A14: 96, B1: 99, B2: 142, B3: 23 })[artifact.id as "A11" | "A12" | "A13" | "A14" | "B1" | "B2" | "B3"]);
      const link = section.locator(`a[href="${artifact.path}"]`);
      await expect(link).toHaveCount(1);
      const response = await request.get((await link.getAttribute("href"))!);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/pdf");
      const bytes = await response.body();
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(100_000);
      expect(bytes.length).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
    }
  });
}
