import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme } from "./helpers";
import data from "../../app/guion/guion-data.json";

test.beforeEach(async ({ context }) => { await blockExternal(context); });

test("the full opening and all 21 scripts are readable with matching thumbnails", async ({ page }) => {
  await page.goto("/guion/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guion de la Cumbre");
  await expect(page.getByText("Hola, Buenas Noches Soy Javier Rebull y mi asesor es el Dr. Vicente García Jiménez.", { exact: true })).toBeVisible();
  await expect(page.getByText("Soy estudiante de la Maestría en Inteligencia Artificial y Analítica de Datos de la UACJ.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lámina anterior", exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("desktop.png"), fullPage: true });
  for (let i = 0; i < data.slides.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "Lámina siguiente", exact: true }).click();
    const slide = data.slides[i];
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(slide.title);
    await expect(page.getByText(slide.paragraphs[0], { exact: true })).toBeVisible();
    const image = page.getByRole("img", { name: new RegExp(`^Lámina ${slide.number} de`) });
    await expect(image).toHaveAttribute("src", slide.image);
    await expect(image).toHaveJSProperty("naturalWidth", 1280);
  }
  await expect(page.getByRole("button", { name: "Lámina siguiente", exact: true })).toBeDisabled();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("desktop uses equal presentation and script panes with controls below", async ({ page }) => {
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/guion/");
    const slidePane = page.getByRole("region", { name: "Lámina de la presentación", exact: true });
    const scriptPane = page.getByRole("region", { name: "Guion para decir en voz alta", exact: true });
    const controls = page.getByRole("group", { name: "Herramientas de ensayo y lectura", exact: true });
    const left = await slidePane.boundingBox();
    const right = await scriptPane.boundingBox();
    const bottom = await controls.boundingBox();
    expect(left && right && bottom).toBeTruthy();
    expect(Math.abs(left!.width - right!.width)).toBeLessThan(2);
    expect(left!.width / width).toBeGreaterThan(0.45);
    expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    expect(bottom!.y).toBeGreaterThanOrEqual(right!.y + right!.height - 1);
    expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(901);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const reader = page.getByRole("region", { name: "Texto del guion, desplazamiento independiente" });
    await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await slidePane.boundingBox())!.y).toBe(left!.y);
    await page.getByRole("button", { name: "Lámina siguiente", exact: true }).click();
    expect(await reader.evaluate(el => el.scrollTop)).toBe(0);
    if (width === 1440) await page.screenshot({ path: test.info().outputPath("split-desktop.png"), fullPage: true });
  }
});

test("keyboard navigation and the live bulletin link work without revealing text", async ({ page }) => {
  await page.goto("/guion/");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(data.slides[1].title);
  await page.keyboard.press("ArrowRight");
  const link = page.getByRole("link", { name: /Abrir Visa Bulletin oficial/ });
  await expect(link).toHaveAttribute("href", "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText(data.slides[2].paragraphs[0], { exact: true })).toBeVisible();
  await expect(page.getByText(/en noviembre de 2023, el Centro Nacional de Visas registraba más de cuatro millones/)).toBeVisible();
  await expect(page.getByRole("link", { name: /^Fuente: 4,034,061 personas · NVC, 1 nov\. 2023 · pp\. 1–3/ })).toHaveAttribute("href", "https://travel.state.gov/content/dam/visas/Statistics/Immigrant-Statistics/WaitingList/WaitingListItem_2023_vF.pdf");
  await expect(page.getByText(/Excluye ajustes de estatus pendientes ante USCIS; no es el total actual/)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(data.slides[1].title);
});

test("font size is bounded and stored as a numeric preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("visapredictai_guion_font_px", "500"));
  await page.goto("/guion/");
  await expect(page.getByRole("button", { name: "Aumentar tamaño de letra" })).toBeDisabled();
  await page.getByRole("button", { name: "Reducir tamaño de letra" }).click();
  await expect(page.getByText("40px", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("visapredictai_guion_font_px"))).toBe("40");
});

test("rehearsal timer starts, pauses and resets without changing slides", async ({ page }) => {
  await page.clock.install();
  await page.goto("/guion/");
  await page.getByRole("button", { name: "Iniciar cronómetro de ensayo", exact: true }).click();
  await page.clock.fastForward(2100);
  await expect(page.getByText("00:02", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pausar cronómetro de ensayo" }).click();
  await page.clock.fastForward(3000);
  await expect(page.getByText("00:02", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(data.slides[0].title);
  await page.getByRole("button", { name: "Reiniciar cronómetro de ensayo" }).click();
  await expect(page.getByRole("group", { name: "Herramientas de ensayo y lectura" }).getByText("00:00", { exact: true })).toBeVisible();
});

test("fullscreen failure preserves the readable script", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { get: () => false }));
  await page.goto("/guion/");
  await page.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cerrar aviso de pantalla completa" })).toBeVisible();
  await expect(page.getByText(/^Hola, Buenas Noches Soy Javier Rebull y mi asesor/)).toBeVisible();
});

test("fullscreen can be entered and left while retaining the practice controls", async ({ page }) => {
  await page.goto("/guion/");
  await page.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.getByRole("button", { name: "Salir de pantalla completa", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Salir de pantalla completa", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

for (const theme of ["light", "dark"] as const) {
  test(`mobile navigation, no overflow and accessibility · ${theme}`, async ({ page }) => {
    await forceTheme(page, theme);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/guion/");
    await page.getByLabel("Ir a lámina").selectOption("2");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(data.slides[2].title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Lámina siguiente", exact: true })).toBeInViewport();
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""));
    expect(violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`mobile-${theme}.png`), fullPage: true });
  });
}
