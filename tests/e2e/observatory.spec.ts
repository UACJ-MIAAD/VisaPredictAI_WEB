// The date observatory lives on the home page (hero, `.home-observatory`).
// Its "View forecast" hands the selected series to VisaBot on /asistente/.
import {mkdirSync,readFileSync} from "node:fs";
import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {buildPanel,countryLabel} from "../../lib/data/panel-core.mjs";
import {blockExternal,forceTheme} from "./helpers";
const panel=buildPanel(readFileSync("public/data/visa_panel_long.csv","utf8"));
const series=(country:string)=>panel.rows.filter(r=>r.country===country&&r.category==="F3"&&r.table==="FAD").sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth));
const home=(lang:"es"|"en")=>lang==="es"?"/":"/en/";
const figureName=(en:boolean)=>en?"Interactive bulletin history":"Historial interactivo del boletín";
/** Stubs the chat function and records every POSTed body. */
async function stubChat(page:Page){
  const bodies:Array<Record<string,unknown>>=[];
  await page.route("**/.netlify/functions/chat",async route=>{
    bodies.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:"text/event-stream",body:'data: {"t":"delta","text":"Respuesta de prueba local."}\n\ndata: {"t":"done"}\n\n'});
  });
  return bodies;
}

for(const lang of ["es","en"] as const)for(const theme of ["light","dark"] as const)for(const width of [320,1280]){
  test(`observatory ${lang} ${theme} ${width}`,async({page,context})=>{
    await blockExternal(context);await forceTheme(page,theme);await page.setViewportSize({width,height:1000});
    await page.goto(home(lang));
    const instrument=page.locator("section#inicio .home-observatory").getByRole("figure",{name:figureName(lang==="en")});
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico").at(-1)!.priorityDate!);
    // Home has no presentation mode, no wide toggle and no console around it.
    await expect(page.getByRole("button",{name:lang==="es"?"Modo presentación":"Presentation mode",exact:true})).toHaveCount(0);
    await expect(instrument.getByRole("button",{name:lang==="es"?"Vista horizontal":"Wide view",exact:true})).toHaveCount(0);
    await expect(page.locator(".vb-console")).toHaveCount(0);
    const slider=instrument.getByRole("slider");
    await expect(slider).toHaveAccessibleName(new RegExp(await instrument.locator(".vb-observatory-scrubber > span").innerText(),"i"));
    await slider.focus();await slider.press("Home");
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico")[0].priorityDate!);
    await slider.press("End");
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("mexico").at(-1)!.priorityDate!);
    for(const button of await instrument.getByRole("group").getByRole("button").all()) {
      const visible=(await button.innerText()).trim();
      await expect(button).toHaveAccessibleName(new RegExp(visible,"i"));
    }
    await instrument.getByRole("button",{name:/India/}).click();
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(series("india").at(-1)!.priorityDate!);
    await expect(instrument.getByRole("button",{name:/India/})).toBeFocused();
    // Hydration and country changes must retain every SVG paint/filter target.
    expect(await instrument.locator("svg[role=img]").evaluate(svg=>{
      const ids=new Set([...svg.querySelectorAll("[id]")].map(n=>n.id));
      return [...svg.querySelectorAll("[fill],[stroke],[filter]")].flatMap(n=>
        ["fill","stroke","filter"].flatMap(a=>{
          const ref=n.getAttribute(a)?.match(/^url\(#(.+)\)$/)?.[1];
          return ref&&!ids.has(ref)?[ref]:[];
        }));
    })).toEqual([]);
    await expect(instrument.getByRole("button",{name:lang==="es"?"Ver pronóstico de esta serie":"View forecast for this series",exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const issues=await new AxeBuilder({page}).include(".vb-observatory").analyze();
    expect(issues.violations.filter(v=>v.impact==="serious"||v.impact==="critical").map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    mkdirSync("e2e-screenshots",{recursive:true});
    await page.screenshot({path:`e2e-screenshots/observatory-${lang}-${theme}-${width}.png`,animations:"disabled"});
    await instrument.screenshot({path:`e2e-screenshots/observatory-instrument-${lang}-${theme}-${width}.png`,animations:"disabled"});
  });
}
test("Current remains Current, and reduced motion stops the trace reveal",async({page,context})=>{
  await blockExternal(context);await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");
  await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  await page.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("F2A");
  await page.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption("DFF");
  await expect(page.locator("[data-vb-observation]")).toHaveText("Current");
  await expect(page.locator(".vb-instrument-line").first()).toHaveCSS("animation-name","none");
});
test("the observatory is the hero of a 720p home page",async({page,context})=>{
  await blockExternal(context);await forceTheme(page,"dark");await page.setViewportSize({width:1280,height:720});
  await page.goto("/");await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  const instrument=page.locator("section#inicio .vb-observatory");
  // It starts inside the first screen and ends within the second one, so the
  // readout, plot and scrubber are reachable with a single scroll.
  const box=(await instrument.boundingBox())!;
  expect(box.y).toBeLessThan(720);
  expect(box.y+box.height).toBeLessThanOrEqual(2*720);
  // Wide variant: the plot sits beside the readout rather than below it.
  expect(box.width).toBeGreaterThan(box.height);
  const readout=(await instrument.locator(".vb-observatory-readout").boundingBox())!;
  const plot=(await instrument.locator(".vb-observatory-plot").boundingBox())!;
  expect(plot.x).toBeGreaterThanOrEqual(readout.x+readout.width-1);
  await instrument.scrollIntoViewIfNeeded();
  await expect(instrument.getByRole("button",{name:"Ver pronóstico de esta serie",exact:true})).toBeInViewport();
  await page.screenshot({path:"e2e-screenshots/observatory-home-720.png",animations:"disabled"});
});

test("all categories and both tables are selectable in the instrument",async({page,context})=>{
  await blockExternal(context);await page.goto("/");
  const instrument=page.getByRole("figure",{name:"Historial interactivo del boletín"});
  const category=instrument.getByRole("combobox",{name:"Categoría del observatorio",exact:true});
  const table=instrument.getByRole("combobox",{name:"Tabla del observatorio",exact:true});
  await expect(category).toBeEnabled();
  expect(await category.locator("option").evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value))).toEqual(panel.categories);
  for(const c of panel.categories)for(const t of panel.tables){
    await category.selectOption(c);await table.selectOption(t);
    const last=panel.rows.filter(r=>r.country==="mexico"&&r.category===c&&r.table===t).sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth)).at(-1);
    await expect(instrument.locator("[data-vb-observation]")).toHaveText(!last?"Sin observación":last.status==="C"?"Current":last.status==="U"?"No disponible":last.priorityDate??"Sin observación");
    await expect(instrument.locator(".vb-instrument-code")).toHaveText(`${c} / ${t}`);
  }
});

// The forecast hand-off follows the selected series: country, category and table.
for(const [lang,country,category,table] of [["es","india","F2A","DFF"],["en","philippines","EB3","FAD"]] as const)test(`view forecast hands ${lang} ${country} ${category} ${table} to VisaBot`,async({page,context})=>{
  await blockExternal(context);const bodies=await stubChat(page);
  const en=lang==="en";
  await page.goto(home(lang));
  const instrument=page.getByRole("figure",{name:figureName(en)});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("button",{name:new RegExp(`^${countryLabel(country,lang)} \\(`)}).click();
  await instrument.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true}).selectOption(category);
  await instrument.getByRole("combobox",{name:en?"Observatory table":"Tabla del observatorio",exact:true}).selectOption(table);
  await instrument.getByRole("button",{name:en?"View forecast for this series":"Ver pronóstico de esta serie",exact:true}).click();
  const expected=en?`Show the ${countryLabel(country,lang)} ${category} ${table} forecast`:`Muéstrame el pronóstico de ${countryLabel(country,lang)} ${category} ${table}`;
  await expect.poll(()=>bodies.length).toBe(1);
  expect(bodies[0].query).toBe(expected);
  // Handed over once, then stripped so a reload does not resend it.
  await expect(page).toHaveURL(new RegExp(`${en?"/en":""}/asistente/$`));
  await expect(page.locator(".vb-console")).toContainText(expected);
  await page.reload();await expect(page.locator(".vb-console textarea")).toBeVisible();
  expect(bodies).toHaveLength(1);
});

for(const [lang,width] of [["es",320],["es",1280],["en",1280]] as const)test(`expanded observatory ${lang} ${width} preserves context and keyboard focus`,async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width,height:720});await page.goto(home(lang));
  const en=lang==="en";
  const instrument=page.getByRole("figure",{name:figureName(en)});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  // The home instrument is always the wide variant.
  if(width>739){const box=await instrument.boundingBox();expect(box!.width).toBeGreaterThan(box!.height);}
  const open=instrument.getByRole("button",{name:en?"Full screen":"Pantalla completa",exact:true});
  await open.click();
  const modal=page.getByRole("dialog",{name:en?"Full screen observatory":"Observatorio en pantalla completa",exact:true});
  await expect(modal).toBeVisible();
  await modal.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true}).selectOption("F2A");
  await modal.getByRole("combobox",{name:en?"Observatory table":"Tabla del observatorio",exact:true}).selectOption("DFF");
  await expect(modal.locator("[data-vb-observation]")).toHaveText("Current");
  await modal.getByRole("slider").press("Home");
  const inspected=await modal.locator("[data-vb-observation]").innerText();
  const sliderValue=await modal.getByRole("slider").inputValue();
  const close=modal.getByRole("button",{name:en?"Close full screen":"Cerrar pantalla completa",exact:true});
  await close.focus();
  for(let i=0;i<14;i++){await page.keyboard.press("Tab");expect(await modal.evaluate(d=>d.contains(document.activeElement))).toBe(true);}
  const issues=await new AxeBuilder({page}).include(".vb-observatory-dialog").analyze();
  expect(issues.violations.filter(v=>v.impact==="serious"||v.impact==="critical").map(v=>v.id)).toEqual([]);
  expect(await modal.evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
  await page.screenshot({path:`e2e-screenshots/observatory-full-${lang}-${width}.png`,animations:"disabled"});
  await page.keyboard.press("Escape");await expect(modal).not.toBeVisible();
  await expect(open).toBeFocused();
  await expect(instrument.locator("[data-vb-observation]")).toHaveText(inspected);
  await expect(instrument.getByRole("slider")).toHaveValue(sliderValue);
  await expect(instrument.locator(".vb-instrument-code")).toHaveText("F2A / DFF");
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");
  await open.click();await modal.getByRole("button",{name:en?"Close full screen":"Cerrar pantalla completa",exact:true}).click();await expect(open).toBeFocused();
});
