import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { blockExternal, forceTheme } from "./helpers";

for (const lang of ["es", "en"] as const) for (const theme of ["light", "dark"] as const) for (const width of [320, 1280]) {
  test(`VisaBot presentation · ${lang} · ${theme} · ${width}`, async ({page, context}) => {
    await blockExternal(context);
    await forceTheme(page, theme);
    await page.setViewportSize({width, height: 900});
    const downloads: string[] = [];
    page.on("request", r => { if (/\/models\/|\/rag\/vectors\.f16/.test(r.url())) downloads.push(r.url()); });
    const requests: {query: string; synthetics?: {kind:string}[]}[] = [];
    await page.route("**/.netlify/functions/chat", async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      const sources = body.synthetics?.length ? [{n:1,title:"Panel",source:"Panel",text:"Datos de prueba."}] : [];
      await route.fulfill({contentType:"text/event-stream",body:
        `data: ${JSON.stringify({t:"sources",sources})}\n\n` +
        `data: ${JSON.stringify({t:"delta",text:body.synthetics?.length ? "Lectura del panel [1]." : "Gracias por consultar."})}\n\n` +
        'data: {"t":"done"}\n\n'});
    });
    await page.goto(lang === "es" ? "/asistente/" : "/en/asistente/");
    await expect(page.locator('[title="country × category × table"], [title="país × categoría × tabla"]').first()).toBeAttached();
    await expect(page.locator(".vb-start-card")).toHaveCount(3);
    await page.getByRole("button", {name:lang === "es" ? "Modo presentación" : "Presentation mode",exact:true}).click();
    const stage = page.getByRole("dialog", {name:lang === "es" ? "VisaBot en modo presentación" : "VisaBot in presentation mode",exact:true});
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    expect(box).toMatchObject({x:0,y:0,width,height:900});
    mkdirSync("e2e-screenshots",{recursive:true});
    await page.screenshot({path:`e2e-screenshots/visabot-stage-${lang}-${theme}-${width}.png`});
    await stage.locator('[data-vb-starter="forecast"]').click();
    await expect(stage.locator(".vb-chart-card")).toBeVisible();
    await expect(stage.locator(".vb-chart-card")).toBeInViewport({ratio:0.6});
    await expect.soft(stage.locator("textarea")).toBeFocused();
    await page.screenshot({path:`e2e-screenshots/visabot-answer-${lang}-${theme}-${width}.png`});
    await expect(stage.getByRole("button",{name:lang === "es" ? "Copiar" : "Copy",exact:true})).toBeVisible();
    expect(requests[0].synthetics?.[0].kind).toBe("forecast_note");
    const thread = stage.getByRole("log");
    await thread.evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(100);
    await thread.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200); // observe the scroll event and following React effect
    expect.soft(await thread.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(5);
    const input = stage.locator("textarea");
    await input.fill("Borrador intacto");
    let navigations = 0;
    page.on("request", r => {if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navigations++;});
    await stage.locator("a.vb-chip").click();
    await expect(page).toHaveURL(/#vb-chart-1$/);
    await expect(input).toHaveValue("Borrador intacto");
    expect(navigations).toBe(0);
    await input.fill(lang === "es" ? "Gracias" : "Thank you");
    await input.press("Enter");
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].synthetics).toBeUndefined();
    await expect(stage.locator(".vb-chart-card")).toHaveCount(1);
    const issues = await new AxeBuilder({page}).include(".vb-console").analyze();
    expect(issues.violations.filter(v => v.impact === "serious" || v.impact === "critical").map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    expect(downloads).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(stage).toHaveCount(0);
    await expect(page.locator(".vb-user")).toHaveCount(2);
    expect(await page.locator("body").evaluate(el=>el.style.overflow)).not.toBe("hidden");
  });
}

test("presentation prompt library is stable and Escape closes the inner dialog first", async ({page,context}) => {
  await blockExternal(context);
  await page.goto("/asistente/");
  await expect(page.getByRole("button",{name:"¿Qué puedes preguntar?",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  const stage = page.getByRole("dialog",{name:"VisaBot en modo presentación",exact:true});
  const open = async () => {
    await page.getByRole("button",{name:"Ejemplos",exact:true}).click();
    const modal = page.getByRole("dialog",{name:"¿Qué puedes preguntar?",exact:true});
    await expect(modal.locator("button.vb-suggest").first()).toBeVisible();
    return modal.locator("button.vb-suggest").allTextContents();
  };
  const first = await open();
  await page.keyboard.press("Escape");
  await expect(stage).toBeVisible();
  const second = await open();
  expect(second).toEqual(first);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(stage).toHaveCount(0);
});
