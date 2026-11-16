import {mkdirSync,readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {blockExternal,forceTheme} from "./helpers";
import {buildPanel} from "../../lib/data/panel-core.mjs";
import {parseForecastStore} from "../../lib/data/forecasts-core.mjs";
import {buildPriorityCheck,priorityCheckSummary,PRIORITY_SOURCE} from "../../lib/visabot/priority-check.mjs";
const file=(n:string)=>readFileSync(`public/data/${n}`,"utf8");
const panel=buildPanel(file("visa_panel_long.csv"));
const store=parseForecastStore(file("forecasts.csv"),JSON.parse(file("forecasts_meta.json")),null);
for(const lang of ["es","en"] as const) for(const theme of ["light","dark"] as const) for(const width of [320,1280]) {
  test(`priority comparison ${lang} ${theme} ${width}`,async({page,context})=>{
    await blockExternal(context);await forceTheme(page,theme);await page.setViewportSize({width,height:900});
    const queries:string[]=[];
    await page.route("**/.netlify/functions/chat",async route=>{
      const body=route.request().postDataJSON();queries.push(body.query);
      const spec=buildPriorityCheck(body.query,panel,store,lang)!;
      const text=priorityCheckSummary(spec,lang);
      await route.fulfill({contentType:"text/event-stream",body:
        `data: ${JSON.stringify({t:"sources",sources:[{n:1,title:spec.title,source:PRIORITY_SOURCE[lang],text}]})}\n\n`+
        `data: ${JSON.stringify({t:"delta",text:text+" [1]"})}\n\n`+'data: {"t":"done"}\n\n'});
    });
    await page.goto(lang==="es"?"/asistente/":"/en/asistente/");
    await expect(page.locator('[title="country × category × table"], [title="país × categoría × tabla"]').first()).toBeAttached();
    const input=page.locator(".vb-console textarea");
    const ask=async(q:string,result:string)=>{
      await input.fill(q);await input.press("Enter");
      const card=page.locator("[data-vb-priority-result]").last();
      await expect(card).toHaveAttribute("data-vb-priority-result",result);
      await expect(page.locator(".vb-console .vb-user")).toHaveCount(queries.length);
      return card;
    };
    const before=await ask(lang==="es"?"cuando me toca F2A pd sept 19 2024 mexicano":"When is my turn, Mexican F2A priority date September 19 2024?","before");
    await expect(before).toContainText("2026-04-22");await expect(before).toContainText("2024-09-19");
    await expect(before).not.toContainText("2026-10-22");
    expect(await page.locator(".vb-console .recharts-surface").count()).toBe(0);
    mkdirSync("e2e-screenshots",{recursive:true});
    await page.screenshot({path:`e2e-screenshots/visabot-priority-before-${lang}-${theme}-${width}.png`});
    const after=await ask(lang==="es"?"¿y mi PD 2099-09-19?":"and my PD 2099-09-19?","after");
    await expect(after).toContainText(lang==="es"?"TODAVÍA NO":"NOT YET");
    await expect(after).toContainText(lang==="es"?"NO supera":"NOT exceed");
    expect(queries.at(-1)?.toLowerCase()).toContain("mexican");
    expect(queries.at(-1)).not.toContain("2024");
    await page.screenshot({path:`e2e-screenshots/visabot-priority-after-${lang}-${theme}-${width}.png`});
    await ask(lang==="es"?"¿y mi PD 2026-04-22?":"and my PD 2026-04-22?","equal");
    const india=await ask(lang==="es"?"¿y India?":"and India?","before");
    await expect(india).toContainText("2026-10-22");
    const current=await ask(lang==="es"?"¿y DFF?":"and DFF?","current");
    await expect(current).toContainText("CURRENT");await expect(current).not.toContainText("2026-10-22");
    await input.fill("Borrador");
    let navigations=0;page.on("request",r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())navigations++;});
    await page.locator(".vb-console a.vb-chip").last().click();
    await expect(input).toHaveValue("Borrador");expect(navigations).toBe(0);
    const issues=await new AxeBuilder({page}).include(".vb-console").analyze();
    expect(issues.violations.filter(v=>v.impact==="serious"||v.impact==="critical").map(v=>v.id)).toEqual([]);
  });
}
test("a stale local card cannot contradict the verified server comparison",async({page,context})=>{
  await blockExternal(context);
  const rows=panel.rows.map(r=>r.country==="mexico"&&r.category==="F2A"&&r.table==="FAD"&&r.bulletinMonth===panel.monthRange[1]?{...r,priorityDate:"2020-04-22"}:r);
  await page.route("**/.netlify/functions/chat",async route=>{
    const spec=buildPriorityCheck(route.request().postDataJSON().query,{...panel,rows},null,"es")!;
    const text=priorityCheckSummary(spec,"es");
    await route.fulfill({contentType:"text/event-stream",body:`data: ${JSON.stringify({t:"sources",sources:[{n:1,title:spec.title,source:PRIORITY_SOURCE.es,text}]})}\n\n`+`data: ${JSON.stringify({t:"delta",text:text+" [1]"})}\n\n`+'data: {"t":"done"}\n\n'});
  });
  await page.goto("/asistente/");
  await expect(page.locator('[title="país × categoría × tabla"]').first()).toBeAttached();
  const input=page.locator(".vb-console textarea");await input.fill("Mexico F2A PD 2024-09-19");await input.press("Enter");
  await expect(page.locator(".vb-console .vb-bot")).toContainText("2020-04-22");
  await expect(page.locator("[data-vb-priority-result]")).toHaveCount(0);
  await expect(page.locator(".vb-console .vb-bot")).not.toContainText("2026-04-22");
  await expect(page.locator(".vb-console a.vb-chip")).toHaveAttribute("href","/datos-historicos#historico");
});
