import {readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import {buildPanel,countryLabel} from "../../lib/data/panel-core.mjs";
import {blockExternal,forceTheme} from "./helpers";

const panel=buildPanel(readFileSync("public/data/visa_panel_long.csv","utf8"));
const monthNumber=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
const cases=[
  {name:"mobile portrait",width:320,height:568,lang:"es",theme:"light"},
  {name:"mobile landscape",width:844,height:390,lang:"en",theme:"dark"},
  {name:"desktop presentation",width:1280,height:720,lang:"es",theme:"dark"},
  {name:"desktop large",width:1920,height:1080,lang:"en",theme:"light"},
] as const;
for(const profile of cases)test.describe(profile.name,()=>{
test.use({isMobile:profile.name.startsWith("mobile"),hasTouch:profile.name.startsWith("mobile")});
test(`all 210 series in full screen · ${profile.name}`,async({page,context})=>{
  test.setTimeout(180_000);
  await blockExternal(context);await forceTheme(page,profile.theme);
  await page.setViewportSize({width:profile.width,height:profile.height});
  await page.goto(profile.lang==="es"?"/asistente/":"/en/asistente/");
  const en=profile.lang==="en";
  const open=page.getByRole("button",{name:en?"Full screen":"Pantalla completa",exact:true});
  if(profile.name.startsWith("mobile"))await open.tap();else await open.click();
  const modal=page.getByRole("dialog",{name:en?"Full screen observatory":"Observatorio en pantalla completa",exact:true});
  const category=modal.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true});
  const table=modal.getByRole("combobox",{name:en?"Observatory table":"Tabla del observatorio",exact:true});
  await expect(category).toBeEnabled();
  const slider=modal.getByRole("slider");
  const readout=modal.locator("[data-vb-observation]");
  let checked=0,lastRows:typeof panel.rows=[];
  for(const country of panel.countries){
    const countryButton=modal.getByRole("group").getByRole("button",{name:new RegExp(countryLabel(country,profile.lang).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"))});
    if(profile.name.startsWith("mobile"))await countryButton.tap();else await countryButton.click();
    for(const c of panel.categories)for(const t of panel.tables){
      await category.selectOption(c);await table.selectOption(t);
      const rows=panel.rows.filter(r=>r.country===country&&r.category===c&&r.table===t).sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth));
      lastRows=rows;
      const label=(i:number)=>{const r=rows[i];return !r?(en?"No observation":"Sin observación"):r.status==="C"?"Current":r.status==="U"?(en?"Unavailable":"No disponible"):r.priorityDate??(en?"No observation":"Sin observación");};
      if(rows.length>1)await slider.press("End");
      await expect(readout,`${country}/${c}/${t} latest`).toHaveText(label(rows.length-1));
      if(rows.length>1){
        await slider.press("Home");await expect(readout,`${country}/${c}/${t} first`).toHaveText(label(0));
        await slider.press("ArrowRight");await expect(readout,`${country}/${c}/${t} next`).toHaveText(label(1));
        await slider.press("End");
      }else await expect(slider).toBeDisabled();
      const problems=await modal.locator("svg[role=img]").evaluate(svg=>{
        const ids=new Set([...svg.querySelectorAll("[id]")].map(n=>n.id));
        const issues:string[]=[];
        for(const node of svg.querySelectorAll("path"))if(/NaN|Infinity/.test(node.getAttribute("d")??""))issues.push("invalid path");
        for(const n of svg.querySelectorAll("[fill],[stroke],[filter]"))for(const a of ["fill","stroke","filter"]){const id=n.getAttribute(a)?.match(/^url\(#(.+)\)$/)?.[1];if(id&&!ids.has(id))issues.push(`missing ${id}`);}
        return issues;
      });
      expect(problems,`${country}/${c}/${t} SVG`).toEqual([]);
      const runs:number[]=[];let size=0;
      for(let i=0;i<rows.length;i++){const row=rows[i];if(i&&monthNumber(row.bulletinMonth)-monthNumber(rows[i-1].bulletinMonth)!==1&&size){runs.push(size);size=0;}if(row.status==="F"&&row.priorityDate)size++;else if(size){runs.push(size);size=0;}}if(size)runs.push(size);
      expect(await modal.locator(".vb-instrument-line").count(),`${country}/${c}/${t} dated runs`).toBe(runs.filter(n=>n>1).length);
      expect(await modal.locator('svg[role="img"] circle').evaluateAll(es=>es.filter(e=>!e.closest(".vb-instrument-cursor")).length),`${country}/${c}/${t} isolated observations`).toBe(runs.filter(n=>n===1).length);
      expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth),`${country}/${c}/${t} overflow`).toBe(true);
      checked++;
    }
  }
  expect(checked).toBe(210);
  if(profile.name.startsWith("mobile")&&lastRows.length>1){
    await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    const row=lastRows[Number(await slider.inputValue())];
    await expect(readout).toHaveText(row.status==="C"?"Current":row.status==="U"?(en?"Unavailable":"No disponible"):row.priorityDate!);
  }
  await modal.getByRole("button",{name:en?"Close full screen":"Cerrar pantalla completa",exact:true}).click();
  await expect(open).toBeFocused();
});
});

test("rotation, zoom, reverse tab, repeated close and restored scrolling",async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width:390,height:844});await page.goto("/asistente/");
  const initial=await page.evaluate(()=>document.body.style.overflow);
  const open=page.getByRole("button",{name:"Pantalla completa",exact:true});
  for(let cycle=0;cycle<4;cycle++){
    await open.click();
    const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
    const category=modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true});
    await expect(category).toBeEnabled();await category.selectOption("F3");
    await modal.getByRole("slider").press("Home");const value=await modal.getByRole("slider").inputValue();
    await page.setViewportSize(cycle%2?{width:390,height:844}:{width:844,height:390});
    await expect(modal.getByRole("slider")).toHaveValue(value);
    await category.focus();await page.keyboard.press("Shift+Tab");
    await expect(modal.getByRole("button",{name:"Ver pronóstico de esta serie",exact:true})).toBeFocused();
    await page.keyboard.press("Tab");await expect(category).toBeFocused();
    await page.keyboard.press("Escape");await expect(modal).not.toBeVisible();await expect(open).toBeFocused();
    expect(await page.evaluate(()=>document.body.style.overflow)).toBe(initial);
  }
});

test("full-screen remains operable with enlarged text and a short viewport",async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width:568,height:320});await page.goto("/asistente/");
  await page.addStyleTag({content:"html { font-size: 200% !important; }"});
  await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
  await expect(modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true})).toBeEnabled();
  expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await modal.getByRole("button",{name:"Cerrar pantalla completa",exact:true}).click();
  await expect(modal).not.toBeVisible();
});

test("back navigation with nested presentation restores body scrolling",async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width:1280,height:720});await page.goto("/");
  await page.getByRole("banner").getByRole("link",{name:"Asistente",exact:true}).click();
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true})).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");
});

for(const viewport of [{width:1280,height:720},{width:1366,height:768},{width:844,height:390},{width:1280,height:1000}])test(`presentation full-screen plot fills ${viewport.width}x${viewport.height}`,async({page,context})=>{
  await blockExternal(context);await page.setViewportSize(viewport);await page.goto("/asistente/");
  await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
  const plot=modal.locator(".vb-observatory-plot");
  expect((await plot.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width*0.8);
  await expect(modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true})).toBeFocused();
  await page.screenshot({path:`e2e-screenshots/observatory-stage-full-${viewport.width}-${viewport.height}.png`,animations:"disabled"});
});

test("the full-screen instrument reports a failed data load and remains closable",async({page,context})=>{
  await blockExternal(context);
  await context.route("**/data/visa_panel_long.csv*",async route=>{await new Promise(r=>setTimeout(r,300));await route.abort();});
  await page.goto("/asistente/");await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
  await expect(modal).toContainText(/No se pudo cargar|No fue posible cargar|No se pudieron cargar/);
  await modal.getByRole("button",{name:"Cerrar pantalla completa",exact:true}).click();
  await expect(modal).not.toBeVisible();
});

test("an isolated published F cutoff remains visible between status gaps",async({page,context})=>{
  await blockExternal(context);await page.goto("/asistente/");
  const instrument=page.getByRole("figure",{name:"Historial interactivo del boletín"});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("button",{name:"China (CN)",exact:true}).click();
  await instrument.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("EB5_RC");
  await instrument.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption("FAD");
  const rows=panel.rows.filter(r=>r.country==="china"&&r.category==="EB5_RC"&&r.table==="FAD").sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth));
  const connected=(a:typeof rows[number]|undefined,b:typeof rows[number]|undefined)=>a?.status==="F"&&b?.status==="F"&&a.priorityDate&&b.priorityDate&&monthNumber(b.bulletinMonth)-monthNumber(a.bulletinMonth)===1;
  const singletons=rows.filter((r,i)=>r.status==="F"&&r.priorityDate&&!connected(rows[i-1],r)&&!connected(r,rows[i+1]));
  expect(singletons.length).toBeGreaterThan(0);
  // These observations must be visible without first selecting their month.
  const markers=instrument.locator('svg[role="img"] circle');
  const count=await markers.evaluateAll(es=>es.filter(e=>!e.closest(".vb-instrument-cursor")).length);
  expect(count).toBe(singletons.length);
});

test("exploring from full screen unmounts the instrument without stealing chat focus",async({page,context})=>{
  await blockExternal(context);
  await context.route("**/.netlify/functions/chat",route=>route.fulfill({status:200,contentType:"text/event-stream",body:'data: {"t":"delta","text":"Respuesta de prueba local."}\n\ndata: {"t":"done"}\n\n'}));
  await page.goto("/asistente/");await expect(page.locator("[data-vb-observation]")).not.toHaveText("—");
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  await page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true}).getByRole("button",{name:"Ver pronóstico de esta serie",exact:true}).click();
  await expect(page.locator(".vb-observatory")).toHaveCount(0);
  await expect(page.locator(".vb-console textarea"),JSON.stringify(await page.evaluate(()=>({activeTag:document.activeElement?.tagName,activeLabel:document.activeElement?.getAttribute("aria-label")})))).toBeFocused();
  await expect(page.getByRole("button",{name:"Salir de presentación",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");
});

test("mobile enlarged text does not clip missing-series readouts",async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width:320,height:568});await page.goto("/asistente/");
  await page.addStyleTag({content:"html { font-size: 200% !important; }"});
  await page.getByRole("button",{name:"Pantalla completa",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
  const missing=panel.categories.flatMap(c=>panel.tables.map(t=>({c,t}))).find(({c,t})=>!panel.rows.some(r=>r.country==="mexico"&&r.category===c&&r.table===t))!;
  await expect(modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true})).toBeEnabled();
  await modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption(missing.c);
  await modal.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption(missing.t);
  const readout=modal.locator("[data-vb-observation]");await expect(readout).toHaveText("Sin observación");
  expect(await readout.evaluate(e=>({content:e.scrollWidth,box:e.clientWidth}))).toMatchObject({content:await readout.evaluate(e=>e.clientWidth)});
});
