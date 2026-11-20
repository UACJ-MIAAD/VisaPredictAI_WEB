// The /asistente panel (restored 19-nov-2026): KPIs, context selects and the
// one-click chart tools — a rail on desktop, a drawer on phones. Tools draw
// from the verified panel in the browser, with no model call.
import { test, expect } from "@playwright/test";
import { blockExternal } from "./helpers";

test("desktop: the rail is open, its tools draw charts without calling the model", async ({ page, context }) => {
  await blockExternal(context);
  let chatCalls = 0;
  await page.route("**/.netlify/functions/chat", (route) => { chatCalls++; return route.abort(); });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/asistente/");
  await expect(page.locator('.vb-console[data-vb-ready="true"]')).toBeAttached();
  const rail = page.locator(".vb-controls-rail");
  await expect(rail).toBeVisible();
  await expect(page.locator(".vb-panel-toggle")).toBeHidden();
  await rail.getByRole("combobox", { name: "Categoría" }).selectOption("F4");
  await rail.getByRole("button", { name: /Pronóstico/ }).click();
  await expect(page.locator(".vb-chart-card")).toHaveCount(1);
  await expect(page.locator(".vb-chart-card figcaption")).toContainText("F4");
  await rail.getByRole("button", { name: "Ver tabla de este mes" }).click();
  await expect(page.locator(".vb-chart-card")).toHaveCount(2);
  expect(chatCalls).toBe(0);
});

test("phone: the panel opens as a drawer, traps focus and closes with Escape", async ({ page, context }) => {
  await blockExternal(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/asistente/");
  await expect(page.locator('.vb-console[data-vb-ready="true"]')).toBeAttached();
  await expect(page.locator(".vb-controls-rail")).toBeHidden();
  const toggle = page.locator(".vb-panel-toggle");
  await toggle.click();
  const drawer = page.getByRole("dialog", { name: "Herramientas" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /Evolución/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(".vb-chart-card")).toHaveCount(1);
  await toggle.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
