import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { blockExternal, forceTheme } from "./helpers";

test("C1 exported endpoints serve the exact manifest-bound records", async ({ request }) => {
  const response = await request.get("/data/release_manifest.json");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  const stateResponse = await request.get("/data/release-state.json");
  expect(stateResponse.status()).toBe(200);
  expect((await stateResponse.json()).release_id).toBe(manifest.release_id);
  for (const [path, output] of [
    ["reports/governance/ingestion_state.json", "ingestion_state.json"],
    ["reports/governance/MODEL_CARD.md", "MODEL_CARD.md"],
    ["vp_data/contracts/ingestion_state.json", "contracts/ingestion_state.json"],
  ]) {
    const record = await request.get(`/data/${output}`);
    expect(record.status()).toBe(200);
    const entry = manifest.artifacts.find((e: { path: string }) => e.path === path);
    expect(entry).toBeDefined();
    const body = await record.body();
    expect(body.length).toBe(entry.size);
    expect(createHash("sha256").update(body).digest("hex")).toBe(entry.sha256);
  }
});

for (const lang of ["es", "en"] as const) for (const theme of ["light", "dark"] as const) {
  for (const scenario of ["loading", "blocked", "ok", "partial", "offline", "invalid", "absent", "unavailable", "network"] as const) {
    test(`source record · ${lang} · ${theme} · ${scenario}`, async ({ page, context }) => {
      await blockExternal(context);
      await forceTheme(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.clock.setFixedTime(new Date(scenario === "ok" ? "2026-10-10T12:00:00Z" : "2026-10-20T12:00:00Z"));
      let requests = 0;
      let release: () => void = () => undefined;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/data/ingestion_state.json", async (route) => {
        requests++;
        if (scenario === "loading") await pending;
        if (scenario === "network") return route.abort();
        if (scenario === "absent") return route.fulfill({ status: 404, body: "missing" });
        if (scenario === "unavailable") return route.fulfill({ status: 503, body: "unavailable" });
        const body = scenario === "invalid" ? "{}" : readFileSync(join(process.cwd(), `tests/fixtures/ingestion_state.${scenario === "loading" ? "blocked" : scenario}.json`), "utf8");
        await route.fulfill({ contentType: "application/json", body });
      });
      await page.goto(`${lang === "en" ? "/en/datos-historicos/" : "/datos-historicos/"}#boletines`);
      await page.locator("#boletines").scrollIntoViewIfNeeded();
      await expect.poll(() => requests).toBeGreaterThan(0);
      const banner = page.getByTestId("source-status");
      if (scenario === "loading") {
        await expect(banner).toHaveAttribute("data-source-kind", "loading");
        await expect(banner).toBeVisible();
        release();
      }
      await expect(banner).toHaveAttribute("data-source-kind", scenario === "loading" ? "blocked" : scenario === "network" ? "unavailable" : scenario);
      await expect(banner).toBeVisible();
      if (scenario === "blocked") {
        await expect(banner.getByTestId("source-stale")).toBeVisible();
        await expect(banner.getByText("2026-09", { exact: true })).toHaveCount(2);
        const expectedMonth = banner.getByText("2026-11", { exact: true });
        await expect(expectedMonth).toHaveCount(2); // calendar expectation and pending-month list
        await expect(expectedMonth.nth(0)).toBeVisible();
        await expect(expectedMonth.nth(1)).toBeVisible();
      }
      if (scenario === "ok") await expect(banner.getByTestId("source-stale")).toHaveCount(0);
      const scan = await new AxeBuilder({ page }).include('[data-testid="source-status"]').analyze();
      expect(scan.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual([]);
      expect(await banner.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      if (scenario === "blocked") await banner.screenshot({ path: test.info().outputPath("source-status.png") });
    });
  }
}
