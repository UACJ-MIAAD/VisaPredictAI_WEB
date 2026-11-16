import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {buildPanel} from "@/lib/data/panel-core";
import {parseForecastStore} from "@/lib/data/forecasts-core.mjs";
import {buildPriorityCheck,parsePriorityDate,isPriorityQuery,priorityCheckSummary} from "@/lib/visabot/priority-check.mjs";
import {mergeFollowUp} from "@/lib/visabot/analytics";
const file=(n:string)=>readFileSync(new URL(`../public/data/${n}`,import.meta.url),"utf8");
const panel=buildPanel(file("visa_panel_long.csv"));
const store=parseForecastStore(file("forecasts.csv"),JSON.parse(file("forecasts_meta.json")),null);
describe("priority-date calendar and input boundaries",()=>{
  it.each(["¿Cuándo me toca México F2A? fecha de prioridad 2024/09/19","cuándo me toca F2A mexicano, fecha de prioridad 19-09-2024","cuándo me toca México F2A con fecha de prioridad 19 de septiembre del 2024","cuándo me toca México F2A, fecha de prioridad 2024-9-19","when is my turn Mexico F2A priority date 9/19/24","cuando me toca Mexico F2A 2024"])("never falls back to an LLM forecast for %s",q=>expect(isPriorityQuery(q)).toBe(true));
  it.each(["¿Cuándo llegó el corte de México F2A FAD a 2024-09-19?","When did Mexico F2A FAD reach September 19, 2024?","What is my priority date?"])("does not turn history/concepts into a personal PD: %s",q=>expect(isPriorityQuery(q)).toBe(false));
  it.each(["2024-09-19","sept 19 2024","September 19th, 2024","19 de septiembre de 2024","19 sep 2024","19/09/2024","09/19/2024"])("%s is the same date",s=>expect(parsePriorityDate(s).date).toBe("2024-09-19"));
  it.each(["2024-02-31","2023-02-29","2024-13-01","31 abril 2024","00/19/2024"])("%s is invalid",s=>expect(parsePriorityDate(s).date).toBeNull());
  it.each(["05/06/2024","2024-09-19 y 2025-09-19","septiembre 2024"])("%s needs clarification",s=>expect(parsePriorityDate(s).issue).not.toBeNull());
  it("accepts a real leap day",()=>expect(parsePriorityDate("29 febrero 2024").date).toBe("2024-02-29"));
  it.each(["What is a priority date?","¿Qué significa fecha de prioridad?","Muéstrame el pronóstico de México F2A"])("does not hijack %s",s=>expect(isPriorityQuery(s)).toBe(false));
});
describe("exact current series, no personal appointment inference",()=>{
  it("filing the petition does not implicitly select the DFF table",()=>{
    expect(buildPriorityCheck("Mi fecha de prioridad es 2026-05-01 (fecha de presentación del I-130), México F2A, ¿cuándo me toca?",panel,store,"es")).toMatchObject({result:"after",table:"FAD",cutoff:"2026-04-22"});
  });
  for(const lang of ["es","en"] as const) {
    it.each([
      ["2024-09-19","before"], ["2026-04-22","equal"], ["2026-04-23","after"], ["2099-09-19","after"],
    ])(`${lang}: %s is %s`,(pd,result)=>{
      const s=buildPriorityCheck(`Mexico F2A FAD PD ${pd}`,panel,store,lang)!;
      expect(s).toMatchObject({result,cutoff:"2026-04-22",priorityDate:pd,country:"mexico",table:"FAD"});
      const text=priorityCheckSummary(s,lang);
      expect(text).not.toContain("2026-10-22");
      expect(text).not.toMatch(/tu turno ya pasó|you will receive|tu cita ser[aá]/i);
      if(result==="before") expect(s.forecastNote).toBeNull();
      else expect(s.statement).toContain(lang==="es"?"TODAVÍA NO":"NOT YET");
      if(pd.startsWith("2099")) expect(s.forecastNote).toContain(lang==="es"?"NO supera":"NOT exceed");
    });
    it(`${lang}: current is distinct from a historical dated cutoff`,()=>{
      expect(buildPriorityCheck("Mexico F2A DFF PD 2024-09-19",panel,store,lang)).toMatchObject({result:"current",cutoff:null,forecastNote:null,table:"DFF"});
    });
  }
  it.each(["F2A PD 2024-09-19","México PD 2024-09-19","México F6 PD 2024-09-19","México India F2A PD 2024-09-19","México F2A F4 PD 2024-09-19","México F2A FAD DFF PD 2024-09-19","México F2A PD 05/06/2024"])("clarifies %s instead of guessing a series/date",q=>{
    expect(buildPriorityCheck(q,panel,store,"es")).toMatchObject({result:"needs_input",cutoff:null,forecastNote:null});
  });
  it("uses the latest U observation, not an older F cutoff",()=>{
    const rows=panel.rows.map(r=>r.country==="mexico"&&r.category==="F2A"&&r.table==="FAD"&&r.bulletinMonth===panel.monthRange[1]?{...r,status:"U",priorityDate:null}:r);
    expect(buildPriorityCheck("Mexico F2A PD 2024-09-19",{...panel,rows},store,"es")).toMatchObject({result:"unavailable",cutoff:null,forecastNote:null});
  });
  it("never carries an older observation into a missing latest cell",()=>{
    const rows=panel.rows.filter(r=>!(r.country==="mexico"&&r.category==="F2A"&&r.table==="FAD"&&r.bulletinMonth===panel.monthRange[1]));
    expect(buildPriorityCheck("Mexico F2A PD 2024-09-19",{...panel,rows},store,"es")).toMatchObject({result:"unknown",cutoff:null});
  });
  it("does not manufacture a drift forecast when production is unavailable",()=>{
    const s=buildPriorityCheck("Mexico F2A PD 2027-09-19",panel,null,"es")!;
    expect(s.result).toBe("after");expect(s.forecastNote).toContain("No hay un pronóstico de producción");
  });
  it("replaces a follow-up PD without keeping the previous date",()=>{
    const q=mergeFollowUp("cuando me toca F2A pd sept 19 2024 mexicano","¿y mi PD 2099-09-19?");
    expect(buildPriorityCheck(q,panel,store,"es")).toMatchObject({result:"after",priorityDate:"2099-09-19",country:"mexico"});
  });
  it("changes country and table while retaining the supplied date",()=>{
    const q=mergeFollowUp("Mexico F2A FAD PD 2024-09-19","and India DFF?");
    expect(buildPriorityCheck(q,panel,store,"en")).toMatchObject({result:"current",country:"india",table:"DFF",priorityDate:"2024-09-19"});
  });
});
