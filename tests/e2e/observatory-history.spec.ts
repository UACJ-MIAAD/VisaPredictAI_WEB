// History start filter of the date observatory, which lives on the home page.
import {readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import {buildPanel} from "../../lib/data/panel-core.mjs";
import {blockExternal} from "./helpers";
import {setHistoryStart} from "./history-filter";
const panel=buildPanel(readFileSync("public/data/visa_panel_long.csv","utf8"));
const monthLabel=(month:string,lang:string)=>new Intl.DateTimeFormat(lang==="es"?"es-MX":"en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T00:00:00Z")).replace(" de "," ").toLowerCase();
const series=(country="mexico",category="F2A",table="FAD")=>panel.rows.filter(r=>r.country===country&&r.category===category&&r.table===table).sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth));
const cutoff=(r:ReturnType<typeof series>[number],en=false)=>r.status==="C"?"Current":r.status==="U"?(en?"Unavailable":"No disponible"):r.priorityDate??(en?"No observation":"Sin observación");

test("month and year handle partial years and restore all history",async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width:320,height:740});await page.goto("/");
  const root=page.locator('figure[data-vb-full="false"]');
  await root.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("F2A");
  const month=root.getByRole("combobox",{name:"Desde el mes",exact:true});
  const year=root.getByRole("combobox",{name:"Desde el año",exact:true});
  await expect(month).toBeDisabled();
  await year.selectOption("2024");await expect(month).toHaveValue("01");
  await month.selectOption("09");await year.selectOption("2025");await expect(month).toHaveValue("09");
  await year.selectOption("2001");await expect(month).toHaveValue("12");
  expect(await month.locator("option").allTextContents()).toEqual(["Mes","diciembre"]);
  await expect(root.locator(".vb-instrument-axis text").first()).toHaveText("diciembre 2001");
  await year.selectOption("2026");await expect(month).toHaveValue("01");
  expect(await month.locator("option").count()).toBe(12); // January–November plus placeholder.
  await year.selectOption("");await expect(month).toHaveValue("");await expect(month).toBeDisabled();
  await expect(root.getByRole("slider")).toHaveAttribute("max",String(series().length-1));
});

test("Home reaches the earliest published month instead of an arbitrary recent window",async({page,context})=>{
  await blockExternal(context);await page.goto("/");
  const instrument=page.getByRole("figure",{name:"Historial interactivo del boletín"});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("F2A");
  await instrument.getByRole("slider").press("Home");
  await expect(instrument.locator("[data-vb-observation]")).toHaveText(cutoff(series()[0]));
  await expect(instrument.locator(".vb-observatory-readout > span").first()).toContainText(monthLabel(series()[0].bulletinMonth,"es"));
  await expect(instrument.getByRole("slider")).toHaveAttribute("max",String(series().length-1));
});

test("full history does not join F cutoffs across missing bulletin months",async({page,context})=>{
  await blockExternal(context);await page.goto("/");
  const instrument=page.getByRole("figure",{name:"Historial interactivo del boletín"});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("button",{name:"All Chargeability (RoW)",exact:true}).click();
  await instrument.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("F1");
  const rows=series("all_chargeability","F1");const ordinal=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
  const runs:number[]=[];let count=0,gaps=0;
  for(let i=0;i<rows.length;i++){
    if(i&&ordinal(rows[i].bulletinMonth)-ordinal(rows[i-1].bulletinMonth)>1){gaps++;if(count)runs.push(count);count=0;}
    if(rows[i].status==="F"&&rows[i].priorityDate)count++;else if(count){runs.push(count);count=0;}
  }if(count)runs.push(count);
  expect(gaps).toBeGreaterThan(0);
  await expect(instrument.locator(".vb-instrument-line")).toHaveCount(runs.filter(n=>n>1).length);
});

test("short date ranges have distinct vertical tick labels",async({page,context})=>{
  await blockExternal(context);await page.goto("/");
  const instrument=page.getByRole("figure",{name:"Historial interactivo del boletín"});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption("EB1");
  await instrument.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption("DFF");
  await setHistoryStart(instrument,"2015-10");
  const ticks=await instrument.locator(".vb-instrument-grid text").allTextContents();
  expect(ticks).toHaveLength(3);expect(new Set(ticks).size).toBe(3);
});

for(const [lang,width] of [["es",320],["es",1280],["en",1280]] as const)test(`history start filter ${lang} ${width} shares state with full screen`,async({page,context})=>{
  await blockExternal(context);await page.setViewportSize({width,height:720});await page.goto(lang==="es"?"/":"/en/");
  const en=lang==="en";
  const instrument=page.getByRole("figure",{name:en?"Interactive bulletin history":"Historial interactivo del boletín"});
  await expect(instrument.locator("[data-vb-observation]")).not.toHaveText("—");
  await instrument.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true}).selectOption("F2A");
  const from=instrument.getByRole("combobox",{name:en?"From month":"Desde el mes",exact:true});
  const year=instrument.getByRole("combobox",{name:en?"From year":"Desde el año",exact:true});
  await expect(from).toHaveValue("");
  expect(await year.locator("option").evaluateAll(es=>es.slice(1).map(e=>(e as HTMLOptionElement).value))).toEqual([...new Set(series().map(r=>r.bulletinMonth.slice(0,4)))]);
  await expect(from).toBeDisabled();
  const start=series()[Math.floor(series().length/2)].bulletinMonth;
  await setHistoryStart(instrument,start,en);await instrument.getByRole("slider").press("Home");
  await expect(instrument.locator("[data-vb-observation]")).toHaveText(cutoff(series().find(r=>r.bulletinMonth===start)!,en));
  await expect(instrument.locator(".vb-instrument-axis text").first()).toHaveText(monthLabel(start,lang));
  await instrument.getByRole("button",{name:en?"Full screen":"Pantalla completa",exact:true}).click();
  const modal=page.getByRole("dialog",{name:en?"Full screen observatory":"Observatorio en pantalla completa",exact:true});
  const fullFrom=modal.getByRole("combobox",{name:en?"From month":"Desde el mes",exact:true});
  await expect(fullFrom).toHaveValue(start.slice(5));
  await expect(modal.getByRole("combobox",{name:en?"From year":"Desde el año",exact:true})).toHaveValue(start.slice(0,4));
  await setHistoryStart(modal,series().at(-1)!.bulletinMonth,en);
  await expect(modal.getByRole("slider")).toBeDisabled();
  await expect(modal.locator("[data-vb-observation]")).toHaveText(cutoff(series().at(-1)!,en));
  expect(await modal.locator('svg[role="img"] circle').evaluateAll(es=>es.filter(e=>!e.closest(".vb-instrument-cursor")).length)).toBe(1);
  await modal.getByRole("button",{name:en?"Close full screen":"Cerrar pantalla completa",exact:true}).click();
  await expect(from).toHaveValue(series().at(-1)!.bulletinMonth.slice(5));
  await setHistoryStart(instrument,"",en);await instrument.getByRole("slider").press("Home");
  await expect(instrument.locator("[data-vb-observation]")).toHaveText(cutoff(series()[0],en));
  await setHistoryStart(instrument,start,en);
  await instrument.getByRole("button",{name:en?"Full screen":"Pantalla completa",exact:true}).click();
  await modal.getByRole("button",{name:"India (IN)",exact:true}).click();
  await expect(fullFrom).toHaveValue("");
  await modal.getByRole("button",{name:en?"Close full screen":"Cerrar pantalla completa",exact:true}).click();
  await expect(from).toHaveValue("");
  await expect(from).toBeDisabled();
  expect(await year.locator("option").count()).toBe(new Set(series("india").map(r=>r.bulletinMonth.slice(0,4))).size+1);
  await instrument.getByRole("combobox",{name:en?"Observatory table":"Tabla del observatorio",exact:true}).selectOption("DFF");
  expect(await year.locator("option").evaluateAll(es=>es.slice(1).map(e=>(e as HTMLOptionElement).value))).toEqual([...new Set(series("india","F2A","DFF").map(r=>r.bulletinMonth.slice(0,4)))]);
  await setHistoryStart(instrument,series("india","F2A","DFF").at(-1)!.bulletinMonth,en);
  await instrument.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true}).selectOption("EB5_RC");
  await expect(from).toHaveValue("");
  await expect(instrument.locator("[data-vb-observation]")).toHaveText(cutoff(series("india","EB5_RC","DFF").at(-1)!,en));
});
