// /resultados (redesign 19-nov-2026): the forecast instrument and the single
// series list, checked against the shipped CSV panel and forecasts.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { buildPanel } from "../../lib/data/panel-core.mjs";
import { parseForecastStore, forecastFor } from "../../lib/data/forecasts-core.mjs";
import { isoDays, epochToDate } from "../../lib/visabot/synthetic-builders.mjs";
import { blockExternal, forceTheme } from "./helpers";
import type { Locator } from "@playwright/test";

// The priority date is three selects (year → month → day), never a native date input.
async function pickDate(root: Locator, iso: string) {
  const [y, m, d] = await root.locator("#fc-pd select").all();
  await y.selectOption(iso.slice(0, 4));
  await m.selectOption(iso.slice(5, 7));
  await d.selectOption(iso.slice(8, 10));
}

const file = (n: string) => readFileSync(`public/data/${n}`, "utf8");
const panel = buildPanel(file("visa_panel_long.csv"));
const store = parseForecastStore(file("forecasts.csv"), JSON.parse(file("forecasts_meta.json")), null);
// Independent recomputation of what the instrument must print (not imported
// from the component's helper): latest cell, and the projection only when the
// latest cell is a date in the latest bulletin and the forecast starts after it.
type Readout = { current: { month: string; status: string; date: string | null } | null; projected: { date: string } | null; none: string | null };
const readout = (key: string): Readout => {
  const [c, cat, t] = key.split("|");
  const rows = panel.rows.filter((r) => r.country === c && r.category === cat && r.table === t).sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  const last = rows.at(-1);
  const current = last ? { month: last.bulletinMonth, status: last.status, date: last.status === "F" ? last.priorityDate : null } : null;
  const pts = forecastFor(store, c, cat, t);
  const none = (n: string): Readout => ({ current, projected: null, none: n });
  if (current && current.month < panel.monthRange[1]) return none("discontinued");
  if (current?.status === "C") return none("current");
  if (current?.status === "U") return none("unavailable");
  const anchor = [...rows].reverse().find((r) => r.status === "F" && r.priorityDate && r.daysSinceBase != null);
  if (!current || !anchor || !pts?.length) return none("noForecast");
  if (pts[0].date.slice(0, 7) <= current.month) return none("stale");
  const base = isoDays(anchor.priorityDate!) - anchor.daysSinceBase!;
  return { current, projected: { date: epochToDate(Math.round(base + pts.at(-1)!.days)) }, none: null };
};
const shown = (r: ReturnType<typeof readout>, en = false) =>
  !r.current ? "—" : r.current.status === "C" ? (en ? "Current" : "Al corriente") : r.current.status === "U" ? (en ? "Unavailable" : "No disponible") : r.current.date!;

for (const lang of ["es", "en"] as const) for (const theme of ["light", "dark"] as const) for (const width of [390, 1280]) {
  test(`forecasts ${lang} ${theme} ${width}`, async ({ page, context }) => {
    await blockExternal(context); await forceTheme(page, theme); await page.setViewportSize({ width, height: 900 });
    const en = lang === "en";
    await page.goto(en ? "/en/resultados/" : "/resultados/");
    const inst = page.locator("#res-forecast");
    const def = readout("mexico|F3|FAD");
    await expect(inst.locator("[data-fc-current]")).toHaveText(shown(def, en));
    if (def.projected) await expect(inst.locator("[data-fc-projected]")).toHaveAttribute("data-date", def.projected.date);

    // country + table + category drive the instrument and the URL
    await inst.getByRole("button", { name: /India/ }).click();
    await inst.locator(".fc-select select").selectOption("EB2");
    await expect(page).toHaveURL(/series=india%7CEB2%7CFAD/);
    const india = readout("india|EB2|FAD");
    await expect(inst.locator("[data-fc-current]")).toHaveText(shown(india, en));
    if (india.projected) await expect(inst.locator("[data-fc-projected]")).toHaveAttribute("data-date", india.projected.date);
    else await expect(inst.locator("[data-fc-projected]")).toHaveAttribute("data-fc-none", india.none!);

    // a list row loads its series into the instrument
    const row = page.getByRole("button", { name: en ? /^Philippines · F4 · FAD\s*,/ : /^Filipinas · F4 · FAD\s*,/ });
    await row.click();
    await expect(inst.locator(".fc-title")).toContainText("F4");
    await expect(page).toHaveURL(/series=philippines%7CF4%7CFAD/);
    await expect(inst.locator("[data-fc-current]")).toHaveText(shown(readout("philippines|F4|FAD"), en));

    // priority date earlier than the cutoff → reached; equal to it → not yet
    const ph = readout("philippines|F4|FAD");
    if (ph.projected && ph.current?.date) {
      await expect(inst.locator('input[type="date"]')).toHaveCount(0);
      await pickDate(inst, "1990-01-01");
      await expect(inst.locator("[data-fc-reach]")).toHaveAttribute("data-fc-reach", "past");
      await pickDate(inst, ph.current.date);
      await expect(inst.locator("[data-fc-reach]")).not.toHaveAttribute("data-fc-reach", "past");
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const issues = await new AxeBuilder({ page }).include("#resultados").analyze();
    expect(issues.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  });
}

for (const why of ["current", "discontinued"] as const) test(`a deep link to a ${why} series shows no projection, and says why`, async ({ page, context }) => {
  await blockExternal(context);
  const key = [...store.series.keys()].find((k) => readout(k).none === why);
  test.skip(!key, `no ${why} series in this release`);
  await page.goto(`/resultados/?series=${encodeURIComponent(key!)}`);
  const inst = page.locator("#res-forecast");
  const [, cat, t] = key!.split("|");
  await expect(inst.locator(".fc-title")).toContainText(cat.replace(/_/g, " "));
  await expect(inst.locator(".fc-title")).toContainText(t);
  await expect(inst.locator("[data-fc-projected]")).toHaveAttribute("data-fc-none", why);
  // nothing to project → no priority-date check and no forecast fan
  await expect(inst.locator("#fc-pd")).toHaveCount(0);
  await expect(inst.locator(".fc-chart")).toBeVisible();
});

test("foreign query parameters and the chart view survive in the URL", async ({ page, context }) => {
  await blockExternal(context);
  await page.goto("/resultados/?utm_source=x&view=full");
  await expect(page.locator("#res-forecast")).toBeVisible();
  await expect(page).toHaveURL(/utm_source=x/);
  await expect(page).toHaveURL(/view=full/);
  await expect(page.getByRole("group", { name: "Vista de la gráfica" }).getByRole("button", { name: "Histórico" })).toHaveAttribute("aria-pressed", "true");
});

test("pinning two series opens the comparison", async ({ page, context }) => {
  await blockExternal(context);
  await page.goto("/resultados/");
  const pins = page.getByRole("button", { name: /^Fijar para comparar:/ });
  await pins.nth(0).click(); await pins.nth(1).click();
  await expect(page).toHaveURL(/pin=/);
  await page.getByRole("button", { name: /Comparar \(2\)/ }).click();
  await expect(page.getByRole("dialog", { name: "Comparación" })).toBeVisible();
});

test("categories carry readable names, searchable in Spanish and English", async ({ page, context }) => {
  await blockExternal(context);
  await page.goto("/resultados/");
  const inst = page.locator("#res-forecast");
  await expect(inst.locator(".fc-catname")).toHaveText("Hijos casados de ciudadanos"); // F3
  await page.getByRole("searchbox").fill("hermanos méxico");
  await expect(page.locator(".fc-row")).not.toHaveCount(0);
  for (const name of await page.locator(".fc-row-cat").allTextContents()) expect(name.replace(/,$/, "")).toBe("Hermanos de ciudadanos");
});

test("the column headers stay visible while scrolling the list (desktop)", async ({ page, context }) => {
  await blockExternal(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/resultados/");
  await expect(page.locator(".fc-row").first()).toBeVisible();
  await page.locator(".fc-row").nth(40).scrollIntoViewIfNeeded();
  const head = await page.locator(".fc-colhead").boundingBox();
  expect(head!.y).toBeGreaterThanOrEqual(0);
  expect(head!.y).toBeLessThan(300);
});
