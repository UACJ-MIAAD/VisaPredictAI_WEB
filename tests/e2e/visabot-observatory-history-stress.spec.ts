import {readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import {buildPanel,countryLabel} from "../../lib/data/panel-core.mjs";
import {blockExternal,forceTheme} from "./helpers";
import {setHistoryStart} from "./history-filter";

const panel=buildPanel(readFileSync("public/data/visa_panel_long.csv","utf8"));
const ordinal=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
const monthLabel=(m:string,en:boolean)=>new Intl.DateTimeFormat(en?"en-US":"es-MX",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-01T00:00:00Z")).replace(" de "," ").toLowerCase();
const profiles=[
  {name:"mobile portrait",width:320,height:568,lang:"es",theme:"light",mobile:true},
  {name:"mobile landscape",width:844,height:390,lang:"en",theme:"dark",mobile:true},
  {name:"desktop presentation",width:1280,height:720,lang:"es",theme:"dark",mobile:false},
  {name:"desktop large",width:1920,height:1080,lang:"en",theme:"light",mobile:false},
] as const;

test("historical source has unique months, safe identifiers and valid dated cutoffs",()=>{
  const keys=new Set<string>(),issues:string[]=[];
  for(const row of panel.rows){
    const key=[row.country,row.category,row.table,row.bulletinMonth].join("/");
    if(!/^[A-Za-z0-9_-]+$/.test(row.category)||!/^[A-Za-z0-9_-]+$/.test(row.table))issues.push(`unsafe identifier ${key}`);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.bulletinMonth))issues.push(`invalid month ${key}`);
    if(keys.has(key))issues.push(`duplicate month ${key}`);keys.add(key);
    if(row.status==="F"){
      const date=new Date(row.priorityDate+"T00:00:00Z");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.priorityDate??"")||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==row.priorityDate)issues.push(`invalid cutoff ${key}`);
    }
  }
  expect(issues).toEqual([]);
});

for(const profile of profiles)test.describe(`From stress ${profile.name}`,()=>{
  test.use({isMobile:profile.mobile,hasTouch:profile.mobile});
  for(const full of [false,true])test(`${full?"full screen":"inline"}: all categories and From boundaries`,async({page,context},testInfo)=>{
    test.setTimeout(300_000);
    await blockExternal(context);await forceTheme(page,profile.theme);
    await page.setViewportSize({width:profile.width,height:profile.height});
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error"&&/unique.*key|hydration|maximum update/i.test(m.text()))errors.push(m.text());});
    const en=profile.lang==="en";
    await page.goto(en?"/en/asistente/":"/asistente/");
    const open=page.getByRole("button",{name:en?"Full screen":"Pantalla completa",exact:true});
    if(full){if(profile.mobile)await open.tap();else await open.click();}
    const root=full?page.getByRole("dialog",{name:en?"Full screen observatory":"Observatorio en pantalla completa",exact:true}):page.locator('figure[data-vb-full="false"]');
    const category=root.getByRole("combobox",{name:en?"Observatory category":"Categoría del observatorio",exact:true});
    const table=root.getByRole("combobox",{name:en?"Observatory table":"Tabla del observatorio",exact:true});
    const from=root.getByRole("combobox",{name:en?"From month":"Desde el mes",exact:true});
    const year=root.getByRole("combobox",{name:en?"From year":"Desde el año",exact:true});
    const slider=root.getByRole("slider");
    await expect(category).toBeEnabled();
    let combinations=0,windows=0;
    for(const country of panel.countries){
      const code=country==="all_chargeability"?"RoW":country==="china"?"CN":country==="india"?"IN":country==="mexico"?"MX":"PH";
      const button=root.getByRole("group").getByRole("button",{name:`${countryLabel(country,profile.lang)} (${code})`,exact:true});
      if(profile.mobile)await button.tap();else await button.click();
      for(const c of panel.categories)for(const t of panel.tables){
        await category.selectOption(c);await table.selectOption(t);
        await expect(from).toHaveValue("");
        const rows=panel.rows.filter(r=>r.country===country&&r.category===c&&r.table===t).sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth));
        const months=rows.map(r=>r.bulletinMonth);
        expect(await year.locator("option").evaluateAll(es=>es.slice(1).map(e=>(e as HTMLOptionElement).value))).toEqual([...new Set(months.map(m=>m.slice(0,4)))]);
        await expect(from).toBeDisabled();
        combinations++;
        if(!rows.length){await expect(from).toBeDisabled();await expect(slider).toBeDisabled();continue;}
        const starts=new Set([0,Math.floor(rows.length/2),rows.length-1]);
        // Exercise a Current/Unavailable boundary and the first monthly gap too.
        const status=rows.findIndex(r=>r.status!=="F");if(status>=0)starts.add(status);
        const gap=rows.findIndex((r,i)=>i>0&&ordinal(r.bulletinMonth)-ordinal(rows[i-1].bulletinMonth)>1);if(gap>=0)starts.add(gap);
        for(const start of starts){
          if(await slider.isEnabled())await slider.press("Home");
          await setHistoryStart(root,months[start],en);
          expect(await from.locator("option").evaluateAll(es=>es.slice(1).map(e=>(e as HTMLOptionElement).value))).toEqual(months.filter(m=>m.startsWith(months[start].slice(0,4))).map(m=>m.slice(5)));
          expect(await from.locator("option").allTextContents()).toEqual([en?"Month":"Mes",...months.filter(m=>m.startsWith(months[start].slice(0,4))).map(m=>new Intl.DateTimeFormat(en?"en-US":"es-MX",{month:"long",timeZone:"UTC"}).format(new Date(m+"-01T00:00:00Z")))]);
          const visible=rows.slice(start);
          const cutoff=(r:typeof rows[number])=>r.status==="C"?"Current":r.status==="U"?(en?"Unavailable":"No disponible"):r.priorityDate;
          await expect(slider).toHaveValue(String(visible.length-1));
          await expect(root.locator("[data-vb-observation]")).toHaveText(cutoff(visible.at(-1)!)!);
          if(visible.length>1)await slider.press("Home");else await expect(slider).toBeDisabled();
          await expect(root.locator("[data-vb-observation]"),`${country}/${c}/${t}/${months[start]} Home`).toHaveText(cutoff(visible[0])!);
          if(visible.length>1)await slider.press("End");
          await expect(root.locator("[data-vb-observation]")).toHaveText(cutoff(visible.at(-1)!)!);
          const runs:number[]=[];let size=0;
          for(let i=0;i<visible.length;i++){
            if(i&&ordinal(visible[i].bulletinMonth)-ordinal(visible[i-1].bulletinMonth)!==1&&size){runs.push(size);size=0;}
            if(visible[i].status==="F")size++;else if(size){runs.push(size);size=0;}
          }if(size)runs.push(size);
          const actual=await root.evaluate(el=>{
            const selects=el.querySelectorAll<HTMLSelectElement>('.vb-observatory-history-start select');
            const value=selects[1].value?`${selects[1].value}-${selects[0].value}`:"";
            const svg=el.querySelector('svg[role="img"]')!;
            return {from:value,max:el.querySelector('input[type="range"]')!.getAttribute("max"),axis:[...el.querySelectorAll(".vb-instrument-axis text")].map(n=>n.textContent),lines:el.querySelectorAll(".vb-instrument-line").length,points:[...svg.querySelectorAll("circle")].filter(n=>!n.closest(".vb-instrument-cursor")).length,ticks:[...el.querySelectorAll(".vb-instrument-grid text")].map(n=>n.textContent),invalid:[...svg.querySelectorAll("path,circle")].some(n=>["d","cx","cy"].some(a=>/NaN|Infinity/.test(n.getAttribute(a)??""))),overflow:el.scrollWidth>el.clientWidth||document.documentElement.scrollWidth>innerWidth||[...el.querySelectorAll(".vb-observatory-controls select,.vb-observatory-readout strong")].some(n=>n.scrollWidth>n.clientWidth)};
          });
          expect(actual,`${countryLabel(country,profile.lang)}/${c}/${t}/${months[start]}`).toEqual({from:months[start],max:String(visible.length-1),axis:[monthLabel(months[start],en),monthLabel(months.at(-1)!,en)],lines:runs.filter(n=>n>1).length,points:runs.filter(n=>n===1).length,ticks:actual.ticks,invalid:false,overflow:false});
          expect(new Set(actual.ticks).size).toBe(actual.ticks.length);
          expect(actual.ticks.length).toBe(visible.some(r=>r.status==="F")?3:0);
          if(full)expect(await page.evaluate(()=>document.body.style.overflow)).toBe("hidden");
          windows++;
        }
        await setHistoryStart(root,"",en);await expect(slider).toHaveAttribute("max",String(rows.length-1));
        await expect(slider).toHaveValue(String(rows.length-1));
      }
    }
    expect(combinations).toBe(210);expect(errors).toEqual([]);
    await testInfo.attach("history-filter-coverage",{body:JSON.stringify({profile,full,combinations,windows}),contentType:"application/json"});
    if(full){await page.keyboard.press("Escape");await expect(root).not.toBeVisible();await expect(open).toBeFocused();}
  });
});

test("active From survives rotation and reopening; source changes reset it inside presentation",async({page,context},testInfo)=>{
  await blockExternal(context);await page.setViewportSize({width:1280,height:720});await page.goto("/asistente/");
  await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
  const open=page.getByRole("button",{name:"Pantalla completa",exact:true});await open.click();
  const modal=page.getByRole("dialog",{name:"Observatorio en pantalla completa",exact:true});
  const category=modal.getByRole("combobox",{name:"Categoría del observatorio",exact:true});
  const from=modal.getByRole("combobox",{name:"Desde el mes",exact:true});
  await expect(category).toBeFocused();await category.selectOption("F2A");
  await setHistoryStart(modal,"2020-01");await modal.getByRole("slider").press("Home");
  const observation=await modal.locator("[data-vb-observation]").textContent();
  for(const viewport of [{width:360,height:740},{width:740,height:360},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    await expect(from).toHaveValue("01");await expect(modal.getByRole("combobox",{name:"Desde el año",exact:true})).toHaveValue("2020");await expect(modal.getByRole("slider")).toHaveValue("0");
    await expect(modal.locator("[data-vb-observation]")).toHaveText(observation!);
    await expect(modal.locator('svg[role="img"]')).toHaveAttribute("viewBox",`0 0 ${viewport.width>=740?960:480} 236`);
    await from.focus();await page.keyboard.press("Tab");
    expect(await modal.evaluate(e=>e.contains(document.activeElement))).toBe(true);
    await testInfo.attach(`filtered-${viewport.width}x${viewport.height}`,{body:await page.screenshot(),contentType:"image/png"});
  }
  await page.keyboard.press("Escape");await expect(modal).not.toBeVisible();await expect(open).toBeFocused();
  await expect(page.getByRole("button",{name:"Salir de presentación",exact:true})).toBeVisible();
  await open.click();await expect(from).toHaveValue("01");
  await setHistoryStart(modal,"2026-11");await category.selectOption("EB5_RC");
  await expect(from).toHaveValue("");
  const lastFor=(country:string,table:string)=>panel.rows.filter(r=>r.country===country&&r.category==="EB5_RC"&&r.table===table).map(r=>r.bulletinMonth).sort().at(-1)!;
  await setHistoryStart(modal,lastFor("mexico","FAD"));
  await modal.getByRole("button",{name:"China (CN)",exact:true}).click();
  await expect(from).toHaveValue("");
  await setHistoryStart(modal,lastFor("china","FAD"));
  await modal.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption("DFF");
  await expect(from).toHaveValue("");
  await category.focus();await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button",{name:"Ver pronóstico de esta serie",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Salir de presentación",exact:true}).click();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");
});

test("presentation cards keep every category and a selected From month readable",async({page,context})=>{
  await blockExternal(context);
  for(const width of [740,844,1024,1280]){
    await page.setViewportSize({width,height:720});await page.goto("/asistente/");
    await page.getByRole("button",{name:"Modo presentación",exact:true}).click();
    const root=page.locator('figure[data-vb-full="false"]');
    for(const c of panel.categories)for(const t of panel.tables){
      await root.getByRole("combobox",{name:"Categoría del observatorio",exact:true}).selectOption(c);
      await root.getByRole("combobox",{name:"Tabla del observatorio",exact:true}).selectOption(t);
      const rows=panel.rows.filter(r=>r.country==="mexico"&&r.category===c&&r.table===t);
      if(rows.length)await setHistoryStart(root,(rows.find(r=>r.bulletinMonth.endsWith("-09"))??rows[0]).bulletinMonth);
      const clipped=await root.locator("select").evaluateAll(es=>es.filter(n=>n.scrollWidth>n.clientWidth).map(n=>({name:n.getAttribute("aria-label"),value:(n as HTMLSelectElement).value,client:n.clientWidth,scroll:n.scrollWidth})));
      expect(clipped,`presentation ${width}/${c}/${t}`).toEqual([]);
    }
  }
});
