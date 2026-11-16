import {mkdirSync,readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {buildPanel} from "../../lib/data/panel-core.mjs";
import {blockExternal,forceTheme} from "./helpers";
const panel=buildPanel(readFileSync("public/data/visa_panel_long.csv","utf8"));
const series=(country:string)=>panel.rows.filter(r=>r.country===country&&r.category==="F3"&&r.table==="FAD").sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth)).slice(-36);
for(const lang of ["es","en"] as const)for(const theme of ["light","dark"] as const)for(const width of [320,1280]){
  test(`observatory ${lang} ${theme} ${width}`,async({page,context})=>{
    await blockExternal(context);await forceTheme(page,theme);await page.setViewportSize({width,height:1000});
    await page.goto(lang==="es"?"/asistente/":"/en/asistente/");
    const instrument=page.getByRole("figure",{name:lang==="es"?"Historial interactivo del boletín":"Interactive bulletin history"});
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico").at(-1)!.priorityDate!);
    await page.getByRole("button",{name:lang==="es"?"Modo presentación":"Presentation mode",exact:true}).click();
    const slider=instrument.getByRole("slider");
    await slider.focus();await slider.press("Home");
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico")[0].priorityDate!);
    await slider.press("End");
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico").at(-1)!.priorityDate!);
    await instrument.getByRole("button",{name:"India",exact:true}).click();
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("india").at(-1)!.priorityDate!);
    await expect(instrument.getByRole("button",{name:"India",exact:true})).toBeFocused();
    await expect(page.locator('[data-vb-starter="forecast"]')).toContainText("India");
    const input=page.locator(".vb-console textarea");await input.fill("Un borrador intacto");
    await page.getByRole("button",{name:lang==="es"?"Haz tu pregunta":"Ask your question",exact:true}).click();
    await expect(input).toBeFocused();await expect(input).toHaveValue("Un borrador intacto");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const issues=await new AxeBuilder({page}).include(".vb-console").analyze();
    expect(issues.violations.filter(v=>v.impact==="serious"||v.impact==="critical").map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await input.fill("");
    mkdirSync("e2e-screenshots",{recursive:true});
    await page.screenshot({path:`e2e-screenshots/observatory-${lang}-${theme}-${width}.png`,animations:"disabled"});
    await instrument.screenshot({path:`e2e-screenshots/observatory-instrument-${lang}-${theme}-${width}.png`,animations:"disabled"});
  });
}
test("Current remains Current, and reduced motion stops the trace reveal",async({page,context})=>{
  await blockExternal(context);await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/asistente/");
  await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  await page.getByRole("combobox",{name:/Categoría/}).selectOption("F2A");
  await page.getByRole("combobox",{name:/Tabla/}).selectOption("DFF");
  await expect(page.locator("[data-vb-observation]")).toHaveText("Current");
  await expect(page.locator(".vb-instrument-line").first()).toHaveCSS("animation-name","none");
});
test("the main scene fits a 720p presentation viewport",async({page,context})=>{
  await blockExternal(context);await forceTheme(page,"dark");await page.setViewportSize({width:1280,height:720});
  await page.goto("/asistente/");await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  await expect(page.locator(".vb-observatory")).toBeInViewport({ratio:0.95});
  await expect(page.getByRole("button",{name:"Haz tu pregunta",exact:true})).toBeInViewport();
  await page.screenshot({path:"e2e-screenshots/observatory-stage-720.png",animations:"disabled"});
});
