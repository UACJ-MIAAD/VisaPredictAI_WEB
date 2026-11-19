// VisaBot agent (lib/visabot/agent.mjs + agent-tools.mjs, wired in
// netlify/functions/chat.mjs). Contracts:
//   (1) tools answer from the committed release fixture with exact ISO facts —
//       the Mexico F4 cutoff the old pipeline misread as China's 2012-10-22;
//   (2) the handler runs the loop: tool_use → tool_result in the next request,
//       {t:"status"} and {t:"source"} frames as tools run, then the answer;
//   (3) show_chart reaches the console as {t:"chart"} and does not exist on the widget;
//   (4) a full date the model writes that nothing it read contains is flagged;
//   (5) bad tool input comes back as is_error, never a crash;
//   (6) close to the 60 s streaming cap the last turn cannot call tools;
//   (7) static rules (cacheable) + per-release catalog from verified data.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "../netlify/functions/chat.mjs";
import { resetSyntheticData } from "../lib/visabot/synthetic-context.mjs";
import { runTool, auditDates, extractDates, toolDefinitions, paceFacts } from "../lib/visabot/agent-tools.mjs";
import { agentSystem } from "../lib/visabot/agent.mjs";
import { buildPanel } from "@/lib/data/panel-core";
import { parseForecastStore } from "@/lib/data/forecasts-core.mjs";
import { anthropicSSE, sseResponse, type MockTurn } from "./anthropic-sse";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = (name: string) => readFileSync(join(root, "public", "data", name));
const panel = buildPanel(String(dataFile("visa_panel_long.csv")));
const store = parseForecastStore(String(dataFile("forecasts.csv")), JSON.parse(String(dataFile("forecasts_meta.json"))), JSON.parse(String(dataFile("forecast_scorecard.json"))));
const latest = panel.monthRange[1];
const row = (c: string, cat: string, t: string, m = latest) =>
  panel.rows.find((r) => r.country === c && r.category === cat && r.table === t && r.bulletinMonth === m)!;
const ctx = (surface = "console") => ({ panel, store, lang: "es" as const, surface });

describe("agent tools over the release fixture", () => {
  it("get_series gives Mexico's own F4 cutoff, never another column", async () => {
    const r = await runTool("get_series", { country: "mexico", category: "F4", table: "FAD" }, ctx());
    const mx = row("mexico", "F4", "FAD");
    const cn = row("china", "F4", "FAD");
    expect(r.error).toBeUndefined();
    expect(r.text).toContain(`Latest bulletin ${latest}: ${mx.priorityDate}`);
    if (cn.priorityDate !== mx.priorityDate) expect(r.text).not.toContain(`Latest bulletin ${latest}: ${cn.priorityDate}`);
    expect(r.text).toMatch(/Historical pace \(descriptive, not a forecast\)/);
  });

  it("get_forecast lists every horizon month with ISO bands and states nothing exists after it", async () => {
    const r = await runTool("get_forecast", { country: "mexico", category: "F4", table: "FAD" }, ctx());
    const months = (r.text.match(/^- \d{4}-\d{2}: central \d{4}-\d{2}-\d{2} · 80% \[\d{4}-\d{2}-\d{2}, \d{4}-\d{2}-\d{2}\] · 95% \[/gm) ?? []).length;
    expect(months).toBe(store.horizonMonths);
    expect(r.text).toMatch(/No projection exists after \d{4}-\d{2}\./);
    expect(r.text).not.toMatch(/\b\d{4}\.\d+\b/); // never decimal years
  });

  it("check_priority_date: before / equal / after follow the strict-earlier rule", async () => {
    const cut = row("mexico", "F2B", "FAD").priorityDate!;
    const shift = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
    const res = async (pd: string) => (await runTool("check_priority_date", { country: "mexico", category: "F2B", table: "FAD", priority_date: pd }, ctx())).text;
    expect(await res(shift(cut, -1))).toMatch(/YA ES ANTERIOR/);
    expect(await res(cut)).toMatch(/IGUAL AL CORTE/);
    const after = await res(shift(cut, 3650));
    expect(after).toMatch(/AÚN NO ALCANZA/);
    expect(after).toMatch(/Gap between the user's date and the latest dated cutoff/);
  });

  it("check_priority_date returns the priority card descriptor and rejects impossible dates", async () => {
    const ok = await runTool("check_priority_date", { country: "mexico", category: "F2B", table: "FAD", priority_date: "2010-03-01" }, ctx());
    expect(ok.chart).toEqual({ kind: "priority_check", country: "mexico", category: "F2B", table: "FAD", priority_date: "2010-03-01" });
    const bad = await runTool("check_priority_date", { country: "mexico", category: "F2B", table: "FAD", priority_date: "2010-02-30" }, ctx());
    expect(bad.error).toBe(true);
  });

  it("compare_countries carries both countries' real cutoffs", async () => {
    const r = await runTool("compare_countries", { countries: ["mexico", "india"], category: "F4", table: "FAD" }, ctx());
    expect(r.text).toContain(row("mexico", "F4", "FAD").priorityDate);
    expect(r.text).toContain(row("india", "F4", "FAD").priorityDate);
  });

  it("unknown inputs and tools become correctable errors; show_chart is console-only", async () => {
    expect((await runTool("get_series", { country: "peru", category: "F4", table: "FAD" }, ctx())).text).toMatch(/unknown country "peru"/);
    expect((await runTool("get_series", { country: "mexico", category: "F9", table: "FAD" }, ctx())).text).toMatch(/unknown category/);
    expect((await runTool("rm_rf", {}, ctx())).error).toBe(true);
    expect((await runTool("show_chart", { kind: "forecast", country: "mexico", category: "F4", table: "FAD" }, ctx("widget"))).error).toBe(true);
    expect(toolDefinitions("widget").map((t: { name: string }) => t.name)).not.toContain("show_chart");
    expect(toolDefinitions("console").map((t: { name: string }) => t.name)).toContain("show_chart");
  });

  it("paceFacts measures advance between dated rows only", () => {
    const rows = panel.rows.filter((r) => r.country === "mexico" && r.category === "F4" && r.table === "FAD").sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
    const p = paceFacts(rows)!;
    expect(p.last.cutoff).toBe(row("mexico", "F4", "FAD").priorityDate);
    expect(p.windows.map((w: { months: number }) => w.months)).toEqual([12, 60, 120]);
  });
});

describe("date audit", () => {
  it("normalizes ISO, Spanish, English and bulletin spellings", () => {
    expect(extractDates("22 de abril de 2001, April 22, 2001, 22 abr. 2001, 22APR01 y 2001-04-22")).toEqual(["2001-04-22"]);
    expect(extractDates("15 de marzo del 2010")).toEqual(["2010-03-15"]);
  });
  it("flags only dates absent from what the model read", () => {
    expect(auditDates("El corte es 22 octubre 2012; antes, 22 de abril de 2001.", ["cutoff 2001-04-22"])).toEqual(["2012-10-22"]);
    expect(auditDates("Corte vigente: 22 de abril de 2001.", ["Latest bulletin: 2001-04-22"])).toEqual([]);
  });
});

describe("agent prompt", () => {
  it("rules are static and cacheable; the catalog carries verified per-release facts", () => {
    const cat = { firstMonth: "2001-12", latestMonth: latest, categories: ["F1", "F4"], horizon: 12 };
    const es = agentSystem({ lang: "es", surface: "console", catalog: cat });
    const en = agentSystem({ lang: "en", surface: "widget", catalog: cat });
    expect(es[0].text).toBe(en[0].text); // identical bytes → shared prompt cache
    expect(es[1].cache_control).toEqual({ type: "ephemeral" });
    expect(es[1].text).toContain(`latest published bulletin: ${latest}`);
    expect(es[1].text).toContain("Production forecast horizon: 12 months");
    expect(es[1].text).toMatch(/show_chart/);
    expect(en[1].text).toMatch(/cannot display charts/);
    expect(es[0].text).toMatch(/prediction intervals/);
    expect(es[0].text).toMatch(/Never call them confidence intervals/);
    expect(es[0].text).toMatch(/Never give or imply a date, month or year beyond the horizon/);
    expect(es[0].text).toMatch(/strictly EARLIER/);
    expect(es[0].text).toMatch(/No emojis/);
    expect(es[0].text).toMatch(/Never write program code/);
  });
});

// ── handler loop ────────────────────────────────────────────────────────────
let ip = 0;
const mkReq = (body: unknown) =>
  new Request("https://visapredictai.com/.netlify/functions/chat", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-nf-client-connection-ip": `10.7.0.${++ip}` },
    body: JSON.stringify(body),
  });
const frames = (sse: string) => sse.split("\n\n").map((e) => e.replace(/^data: /, "")).filter((p) => p.startsWith("{")).map((p) => JSON.parse(p));

describe("chat handler — agent loop", () => {
  let bodies: Record<string, unknown>[];
  const script = (turns: MockTurn[]) => {
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith("https://api.anthropic.com")) {
        bodies.push(JSON.parse(String(init?.body)));
        return sseResponse(anthropicSSE(turns[Math.min(i++, turns.length - 1)]));
      }
      if (u.startsWith("https://cdn.test/data/")) {
        const buf = dataFile(u.replace("https://cdn.test/data/", ""));
        return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } as never;
      }
      throw new Error(`unexpected fetch ${u}`);
    }));
  };
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.VISABOT_DATA_BASE = "https://cdn.test";
    bodies = [];
    resetSyntheticData();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VISABOT_TOOL_BUDGET_MS;
    resetSyntheticData();
  });

  it("tool_use → verified tool_result → cited answer, with status and source frames", async () => {
    const mx = row("mexico", "F4", "FAD").priorityDate!;
    script([
      { tools: [{ id: "tu_1", name: "get_forecast", input: { country: "mexico", category: "F4", table: "FAD" } }] },
      { text: [`El corte vigente de México F4 es ${mx} [1].`] },
    ]);
    const out = frames(await (await handler(mkReq({ lang: "es", query: "¿cuándo avanza México F4?", surface: "console" }))).text());
    expect(bodies).toHaveLength(2);
    const toolResult = JSON.stringify((bodies[1].messages as { role: string; content: unknown }[]).at(-1));
    expect(toolResult).toContain("tool_result");
    expect(toolResult).toContain(mx);
    const status = out.find((f) => f.t === "status");
    expect(status.text).toMatch(/pronóstico de México · F4 · FAD/);
    const src = out.find((f) => f.t === "source").source;
    expect(src.n).toBe(1);
    expect(src.url).toBe("/datos-historicos/#pronostico");
    expect(src.text).toContain(mx);
    const answer = out.filter((f) => f.t === "delta").map((f) => f.text).join("");
    expect(answer).toContain(mx);
    expect(answer).not.toMatch(/no pude confirmar/);
    expect(out.at(-1)).toEqual({ t: "done" });
    // request shape: adaptive thinking, effort, tools, cached catalog
    expect(bodies[0].thinking).toEqual({ type: "adaptive" });
    expect((bodies[0].output_config as { effort: string }).effort).toBe("low");
    expect((bodies[0].system as { cache_control?: unknown }[])[1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("an invented full date is flagged in the answer itself", async () => {
    script([
      { tools: [{ id: "tu_1", name: "get_series", input: { country: "mexico", category: "F4", table: "FAD" } }] },
      { text: ["El corte de México F4 es el 22 de octubre de 2099 [1]."] },
    ]);
    const answer = frames(await (await handler(mkReq({ lang: "es", query: "corte México F4" }))).text())
      .filter((f) => f.t === "delta").map((f) => f.text).join("");
    expect(answer).toMatch(/no pude confirmar estas fechas en los datos consultados: 2099-10-22/);
  });

  it("the user's own priority date is not flagged; the priority card reaches the console", async () => {
    script([
      { tools: [{ id: "tu_1", name: "check_priority_date", input: { country: "mexico", category: "F2B", table: "FAD", priority_date: "2010-03-01" } }] },
      { text: ["Tu fecha (1 de marzo de 2010) ya es anterior al corte [1]."] },
    ]);
    const out = frames(await (await handler(mkReq({ lang: "es", query: "Soy de México, F2B, mi fecha de prioridad es marzo 2010", surface: "console" }))).text());
    expect(out.find((f) => f.t === "chart").chart).toMatchObject({ kind: "priority_check", priority_date: "2010-03-01" });
    expect(out.find((f) => f.t === "source").source.text).toMatch(/YA ES ANTERIOR/);
    expect(out.filter((f) => f.t === "delta").map((f) => f.text).join("")).not.toMatch(/no pude confirmar/);
  });

  it("show_chart emits a chart frame on the console only", async () => {
    const turns: MockTurn[] = [
      { tools: [{ id: "tu_1", name: "show_chart", input: { kind: "history", country: "india", category: "EB2", table: "FAD" } }] },
      { text: ["Listo."] },
    ];
    script(turns);
    const c = frames(await (await handler(mkReq({ lang: "es", query: "gráfica india eb2", surface: "console" }))).text());
    expect(c.find((f) => f.t === "chart").chart).toEqual({ kind: "history", table: "FAD", country: "india", category: "EB2" });
    bodies = [];
    script(turns);
    const w = frames(await (await handler(mkReq({ lang: "es", query: "gráfica india eb2", surface: "widget" }))).text());
    expect(w.find((f) => f.t === "chart")).toBeUndefined();
    expect((bodies[0].tools as { name: string }[]).map((t) => t.name)).not.toContain("show_chart");
    expect(JSON.stringify(bodies[1].messages)).toContain('"is_error":true');
  });

  it("bad tool input returns is_error to the model and the answer continues", async () => {
    script([
      { tools: [{ id: "tu_1", name: "get_series", input: { country: "brasil", category: "F4", table: "FAD" } }] },
      { text: ["Ese país no está en el panel."] },
    ]);
    const out = frames(await (await handler(mkReq({ lang: "es", query: "brasil F4" }))).text());
    expect(JSON.stringify(bodies[1].messages)).toMatch(/"is_error":true.*unknown country/);
    expect(out.some((f) => f.t === "error")).toBe(false);
  });

  it("past the tool budget the turn cannot call tools", async () => {
    process.env.VISABOT_TOOL_BUDGET_MS = "1";
    script([{ text: ["Respuesta con lo disponible."] }]);
    await new Promise((r) => setTimeout(r, 5));
    await (await handler(mkReq({ lang: "es", query: "México F4" }))).text();
    expect(bodies[0].tool_choice).toEqual({ type: "none" });
  });

  it("per-question domain reminders travel as a mid-conversation system message", async () => {
    script([{ text: ["ok"] }]);
    await (await handler(mkReq({ lang: "es", query: "¿Qué modelo gana en DFF?" }))).text();
    const msgs = bodies[0].messages as { role: string; content: string }[];
    expect(msgs.at(-1)!.role).toBe("system");
    expect(msgs.at(-1)!.content).toMatch(/RECORDATORIOS PARA ESTA PREGUNTA/);
    expect(msgs.at(-2)!.role).toBe("user");
  });
});
