import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chartForQuery } from "@/lib/visabot/chart-router";
import { buildPanel } from "@/lib/data/panel-core";
const panel = buildPanel(readFileSync(new URL("../public/data/visa_panel_long.csv", import.meta.url), "utf8"));
const months = [...new Set(panel.rows.map(r => r.bulletinMonth))].sort();
describe("rehearsal routing (Opus findings, executed)", () => {
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
