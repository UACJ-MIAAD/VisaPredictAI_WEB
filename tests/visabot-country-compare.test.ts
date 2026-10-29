// Production 29-oct-2026, «Compara México F2A con India F2A»: the console took
// only the first country, drew México alone and grounded a bare chart title, so
// the model told the user India F2A had no validated data. Both series are in
// the panel and in forecasts.csv. These tests run the real path: released
// artifacts → chat handler → the request body that would reach Anthropic.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DATA_PINS } from "../lib/content/data-pins.generated.mjs";
import { resetSyntheticData } from "@/lib/visabot/synthetic-context.mjs";
import { buildPanel } from "@/lib/data/panel-core";
import { parseForecastStore } from "@/lib/data/forecasts-core.mjs";
import { buildMultiLine, detectCountries, seriesCompareFacts, seriesCompareSummary } from "@/lib/visabot/analytics";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = (name: string) => readFileSync(join(root, "public", "data", name));

// Latest official cell per country, read straight from the CSV.
const latest = (country: string) => String(dataFile("visa_panel_long.csv")).split("\n")
  .filter((l) => l.startsWith(`${country},family,F2A,FAD,`)).map((l) => l.split(","))
  .sort((a, b) => a[4].localeCompare(b[4])).pop()!;
const cellOf = (r: string[]) => (r[5] === "F" ? r[6] : r[5]);

describe("country comparison over the released artifacts (chat handler → Anthropic body)", () => {
  let sentBodies: string[] = [];
  const resLike = (buf: Buffer | null) => ({
    ok: !!buf,
    arrayBuffer: async () => buf!.buffer.slice(buf!.byteOffset, buf!.byteOffset + buf!.byteLength),
  });
  const fetchStub = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith("https://api.anthropic.com")) {
      sentBodies.push(String(init?.body));
      return new Response('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    if (u.startsWith("https://cdn.test/data/")) {
      try { return resLike(dataFile(u.replace("https://cdn.test/data/", ""))) as never; } catch { return resLike(null) as never; }
    }
    throw new Error(`unexpected fetch ${u}`);
  });
  const post = async (lang: "es" | "en", synthetics: unknown[]) => {
    const { default: handler } = await import("../netlify/functions/chat.mjs");
    return handler(new Request("https://visapredictai.com/.netlify/functions/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ lang, query: "Compara México F2A con India F2A", surface: "console", synthetics }),
    }));
  };
  const compare = (countries: string[]) =>
    ({ kind: "series_compare", countries, category: "F2A", table: "FAD", release_id: DATA_PINS.releaseId });

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-never-used";
    process.env.VISABOT_DATA_BASE = "https://cdn.test";
    sentBodies = [];
    resetSyntheticData();
    vi.stubGlobal("fetch", fetchStub);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VISABOT_DATA_BASE;
    resetSyntheticData();
  });

  for (const lang of ["es", "en"] as const) {
    it(`${lang}: both countries reach the model with their real cutoffs and forecast`, async () => {
      const res = await post(lang, [compare(["mexico", "india"])]);
      expect(res.status).toBe(200);
      await res.text();
      const system = (JSON.parse(sentBodies[0]) as { system: string }).system;
      expect(system).toMatch(lang === "en" ? /COUNTRY COMPARISON/ : /COMPARACIÓN DE PAÍSES/);
      for (const c of ["mexico", "india"]) expect(system).toContain(cellOf(latest(c)));
      expect(system).toMatch(/India \d{4}-\d{2}-\d{2}/);
      expect(system).not.toMatch(/India —; |India —$/m);
    });
  }

  it("rejects one country, repeats and unknown codes", async () => {
    for (const cs of [["mexico"], ["mexico", "mexico"], ["mexico", "atlantis"]]) {
      const res = await post("es", [compare(cs)]);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
    expect(sentBodies).toHaveLength(0);
  });
});

describe("the console side of the comparison", () => {
  const panel = buildPanel(String(dataFile("visa_panel_long.csv")));
  const store = parseForecastStore(String(dataFile("forecasts.csv")),
    JSON.parse(String(dataFile("forecasts_meta.json"))), JSON.parse(String(dataFile("forecast_scorecard.json"))));

  it("detects every named country in the order named", () => {
    expect(detectCountries("Compara México F2A con India F2A")).toEqual(["mexico", "india"]);
    expect(detectCountries("India vs China vs Filipinas EB2")).toEqual(["india", "china", "philippines"]);
    expect(detectCountries("Muéstrame México F4")).toEqual(["mexico"]);
  });

  it("the chart holds just the named countries and the summary has both", () => {
    const chart = buildMultiLine(panel, "F2A", "FAD", "es", store, ["mexico", "india"])!;
    if (chart.kind !== "multiline") throw new Error("expected multiline");
    expect(chart.series.map((s) => s.key)).toEqual(["mexico", "india"]);
    expect(chart.title).toBe("México vs India · F2A · FAD");
    const facts = seriesCompareFacts(panel, ["mexico", "india"], "F2A", "FAD", store)!;
    const summary = seriesCompareSummary(facts, "es");
    for (const c of ["mexico", "india"]) expect(summary).toContain(cellOf(latest(c)));
    expect(facts.cols.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.fc))).toBe(true);
  });
});
