import {mkdirSync,readFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {blockExternal,forceTheme} from "./helpers";
import {buildPanel} from "../../lib/data/panel-core.mjs";
import {parseForecastStore} from "../../lib/data/forecasts-core.mjs";
import {priorityCheckSpec,priorityCheckSummary,PRIORITY_SOURCE} from "../../lib/visabot/priority-check.mjs";
// The agent reads the user's words and calls check_priority_date with structured
// input; this table stands in for the model so the console flow is deterministic.
type Ask={country:string;category:string;table:string;priority_date:string};
const MX_F2A={country:"mexico",category:"F2A",table:"FAD",priority_date:"2024-09-19"};
const INTENT:Record<string,Ask>={
  "cuando me toca F2A pd sept 19 2024 mexicano":MX_F2A,"When is my turn, Mexican F2A priority date September 19 2024?":MX_F2A,
  "¿y mi PD 2099-09-19?":{...MX_F2A,priority_date:"2099-09-19"},"and my PD 2099-09-19?":{...MX_F2A,priority_date:"2099-09-19"},
  "¿y mi PD 2026-04-22?":{...MX_F2A,priority_date:"2026-04-22"},"and my PD 2026-04-22?":{...MX_F2A,priority_date:"2026-04-22"},
  "¿y India?":{...MX_F2A,country:"india"},"and India?":{...MX_F2A,country:"india"},
  "¿y DFF?":{...MX_F2A,country:"india",table:"DFF"},"and DFF?":{...MX_F2A,country:"india",table:"DFF"},
  "Mexico F2A PD 2024-09-19":MX_F2A,
};
// What the server streams after check_priority_date: the tool source, the
// chart descriptor (with its verified outcome) and the answer citing [1].
const serverReply=(a:Ask,p:typeof panel,lang:"es"|"en")=>{
  const spec=priorityCheckSpec({priorityDate:a.priority_date,country:a.country,category:a.category,table:a.table},p,store,lang);
  const text=priorityCheckSummary(spec,lang);
  return `data: ${JSON.stringify({t:"source",source:{n:1,title:spec.title,source:PRIORITY_SOURCE[lang],text,url:lang==="en"?"/en/datos-historicos/#historico":"/datos-historicos/#historico"}})}\n\n`+
    `data: ${JSON.stringify({t:"chart",chart:{kind:"priority_check",...a,result:spec.result,cutoff:spec.cutoff}})}\n\n`+
    `data: ${JSON.stringify({t:"delta",text:text+" [1]"})}\n\n`+'data: {"t":"done"}\n\n';
};
const file=(n:string)=>readFileSync(`public/data/${n}`,"utf8");
const panel=buildPanel(file("visa_panel_long.csv"));
const store=parseForecastStore(file("forecasts.csv"),JSON.parse(file("forecasts_meta.json")),null);
for(const lang of ["es","en"] as const) for(const theme of ["light","dark"] as const) for(const width of [320,1280]) {
  test(`priority comparison ${lang} ${theme} ${width}`,async({page,context})=>{
    await blockExternal(context);await forceTheme(page,theme);await page.setViewportSize({width,height:900});
    const queries:string[]=[];
    await page.route("**/.netlify/functions/chat",async route=>{
      const body=route.request().postDataJSON();queries.push(body.query);
      await route.fulfill({contentType:"text/event-stream",body:serverReply(INTENT[body.query],panel,lang)});
    });
    await page.goto(lang==="es"?"/asistente/":"/en/asistente/");
    await expect(page.locator('.vb-console[data-vb-ready="true"]')).toBeAttached();
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
    await route.fulfill({contentType:"text/event-stream",body:serverReply(INTENT[route.request().postDataJSON().query],{...panel,rows},"es")});
  });
  await page.goto("/asistente/");
  await expect(page.locator('.vb-console[data-vb-ready="true"]')).toBeAttached();
  const input=page.locator(".vb-console textarea");await input.fill("Mexico F2A PD 2024-09-19");await input.press("Enter");
  await expect(page.locator(".vb-console .vb-bot")).toContainText("2020-04-22");
  await expect(page.locator("[data-vb-priority-result]")).toHaveCount(0);
  await expect(page.locator(".vb-console .vb-bot")).not.toContainText("2026-04-22");
  await expect(page.locator(".vb-console a.vb-chip")).toHaveAttribute("href","/datos-historicos/#historico");
  await expect(page.locator(".vb-console .recharts-surface")).toHaveCount(0);
});
