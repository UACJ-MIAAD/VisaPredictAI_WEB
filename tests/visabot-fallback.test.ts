// Extractive fallback ("Respondo desde la documentación del proyecto") must never
// show the user the LLM-facing grounding prompt. Seen in production 27-oct-2026:
// «pronóstico zoom México F2A FAD» with the live assistant offline printed «Se
// está mostrando al usuario un GRÁFICO DE PRONÓSTICO… NO digas que no puedes
// mostrar gráficos…». The synthetic note stays a prompt (its grammar is pinned
// by chat-proxy.test.ts); the fallback shows its user-facing summary instead.
import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import {
  buildForecast, buildStatus, buildBulletinDiff, chartContextNote, chartUserNote, type ChartSpec,
} from "@/lib/visabot/analytics";
import type { ForecastStore } from "@/lib/data/forecasts";
import { unavailableStore } from "@/lib/data/forecasts-core.mjs";
import { extractive } from "@/components/visabot/engine";
import type { Source } from "@/components/visabot/types";
import { PANEL_CSV, linearSeriesCsv } from "./fixtures";

const DIRECTIVE =
  /NO digas|NO te niegues|NO presentes|descr[ií]bel[oa]|Se está mostrando al usuario|Si el usuario|Indica al usuario|do NOT|being (shown|rendered) to the user|If the user|Tell the user/;

const series = buildPanel(linearSeriesCsv(12));
const fixture = buildPanel(PANEL_CSV);
const down = unavailableStore("fetch") as ForecastStore;

// Same shape the console's prepare() prepends (synthetic: true), plus one RAG chunk.
const asConsole = (chart: ChartSpec, lang: "es" | "en"): Source[] => [
  { n: 1, title: chart.title, source: "Gráfico en vivo (panel de datos real)", url: "/asistente", text: chartContextNote(chart, lang)!, display: chartUserNote(chart, lang) ?? undefined, synthetic: true },
  { n: 2, title: "Visa Bulletin", source: "Glosario", url: "/glosario", text: "Boletín mensual del U.S. Department of State." },
];

const charts = (lang: "es" | "en"): [string, ChartSpec][] => [
  ["forecast", buildForecast(series, "mexico", "F4", "FAD", lang, 12, 48)!],
  ["forecast (production unavailable)", buildForecast(series, "mexico", "F4", "FAD", lang, 12, 48, down)!],
  ["status", buildStatus(fixture, lang)],
  ["bulletin diff", buildBulletinDiff(fixture, "2024-07", "2024-09", "FAD", lang)!],
];

describe("extractive fallback never leaks the grounding prompt", () => {
  for (const lang of ["es", "en"] as const)
    it.each(charts(lang))(`${lang}: %s`, (_kind, chart) => {
      // the note IS a prompt — that is what the fallback must not print
      expect(chartContextNote(chart, lang)).toMatch(DIRECTIVE);
      const out = extractive(asConsole(chart, lang), lang);
      expect(out).not.toMatch(DIRECTIVE);
      expect(out).toContain(chart.title);
      expect(out).toContain("Boletín mensual"); // the RAG chunk still shows
    });

  it("forecast summary keeps the real figures and the abstention, without the orders", () => {
    const chart = buildForecast(series, "mexico", "F4", "FAD", "es", 12, 48)!;
    if (chart.kind !== "forecast") throw new Error("expected forecast");
    const s = chartUserNote(chart, "es")!;
    const end = chart.data[chart.data.length - 1];
    expect(s).toContain(end.date);
    expect(s).toContain("travel.state.gov");
    expect(s).not.toMatch(DIRECTIVE);
  });

  it("an outage summary gives no projected figures", () => {
    const chart = buildForecast(series, "mexico", "F4", "FAD", "en", 12, 48, down)!;
    const s = chartUserNote(chart, "en")!;
    expect(s).toContain("temporarily unavailable");
    expect(s).not.toMatch(/Projection at the|95% band \[/);
  });

  it("a synthetic source without a user-facing summary is dropped, never printed raw", () => {
    const out = extractive([
      { n: 1, title: "Chart", source: "x", url: "/", text: "Se está mostrando al usuario un gráfico — NO digas que no.", synthetic: true },
      { n: 2, title: "Doc", source: "y", url: "/", text: "Texto de documentación." },
    ], "es");
    expect(out).not.toMatch(DIRECTIVE);
    expect(out).toContain("Texto de documentación.");
  });
});
