import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chartForQuery, chartFromAgent } from "@/lib/visabot/chart-router";
import { buildPanel } from "@/lib/data/panel-core";
const panel = buildPanel(readFileSync(new URL("../public/data/visa_panel_long.csv", import.meta.url), "utf8"));
const months = [...new Set(panel.rows.map(r => r.bulletinMonth))].sort();
describe("rehearsal routing (Opus findings, executed)", () => {
  // Priority dates are read by the agent (check_priority_date); the console
  // draws the card from the descriptor it emits, never from a regex parse.
  it("the agent's priority card for an already-reached date says so", () => {
    expect(chartFromAgent({kind:"priority_check",country:"mexico",category:"F2A",table:"FAD",priority_date:"2024-09-19"}, panel, "es", null)).toMatchObject({kind:"priorityCheck",result:"before",cutoff:"2026-04-22",priorityDate:"2024-09-19"});
  });
  it("the agent's priority card states clearly when a date is not yet before the cutoff", () => {
    expect(chartFromAgent({kind:"priority_check",country:"mexico",category:"F2A",table:"FAD",priority_date:"2027-09-19"}, panel, "es", null)).toMatchObject({kind:"priorityCheck",result:"after",cutoff:"2026-04-22"});
  });
  it("the wording router no longer turns a priority-date question into a rigid card", () => {
    expect(chartForQuery("Soy de México, F2B, mi fecha de prioridad es marzo 2010. ¿Cuándo me toca?", panel, "es", null)?.chart.kind).not.toBe("priorityCheck");
  });
  it.each([
    [{kind:"forecast",country:"mexico",category:"F4",table:"FAD"}, "forecast"],
    [{kind:"history",country:"india",category:"EB2",table:"FAD"}, "line"],
    [{kind:"bulletin_table",month:months.at(-1),table:"DFF"}, "table"],
    [{kind:"bulletin_diff",month:months.at(-2),month_b:months.at(-1),table:"FAD"}, "bulletinDiff"],
  ] as const)("chartFromAgent draws %j", (d, kind) => {
    expect(chartFromAgent(d as never, panel, "es", null)?.kind).toBe(kind);
  });
  it.each(["¿Qué cambió en el último boletín?", "What changed in the latest bulletin?", "Compara dos boletines", "Compare two bulletins"])("%s compares actual consecutive bulletins", q => {
    const result = chartForQuery(q, panel, "es", null);
    expect(result?.descriptor).toMatchObject({kind: "bulletin_diff", monthA: months.at(-2), monthB: months.at(-1)});
  });
  it.each(["¿Qué fecha de prioridad tiene México F2A en el último boletín?", "What is the Mexico F2A cutoff in the latest bulletin?"])("%s shows the historical table", q => {
    expect(chartForQuery(q, panel, "es", null)?.descriptor).toMatchObject({kind: "month_table", month: months.at(-1)});
  });
  it("past movement does not produce a forecast", () => {
    expect(chartForQuery("¿Cuándo retrocedió México F2A?", panel, "es", null)?.chart.kind).toBe("movement");
  });
  it("the word proyecto does not mean proyección", () => {
    expect(chartForQuery("¿Qué dice el proyecto sobre India EB2?", panel, "es", null)?.chart.kind).not.toBe("forecast");
  });
  it("does not silently substitute the latest month for an unavailable requested month", () => {
    expect(chartForQuery("¿Qué cambió en el boletín de noviembre 2045?", panel, "es", null)).toBeNull();
  });
  it("keeps future intent when explicitly asking for the forecast", () => {
    expect(chartForQuery("Muéstrame el pronóstico de México F4", panel, "es", null)?.chart.kind).toBe("forecast");
  });
});
describe("agent date comparison vs stale local data", () => {
  const d = {kind:"priority_check",country:"mexico",category:"F2A",table:"FAD",priority_date:"2024-09-19"} as const;
  it("draws the card when the server's verified outcome matches the local data", () => {
    expect(chartFromAgent({...d,result:"before",cutoff:"2026-04-22"}, panel, "es", null)?.kind).toBe("priorityCheck");
  });
  it.each([[{result:"after",cutoff:"2020-04-22"}],[{result:"before",cutoff:"2025-01-01"}]])("drops the card when the server saw %j", (srv) => {
    expect(chartFromAgent({...d,...srv}, panel, "es", null)).toBeNull();
  });
});
