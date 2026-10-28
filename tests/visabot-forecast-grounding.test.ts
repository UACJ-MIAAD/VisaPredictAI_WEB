// Production 28-oct-2026, «Muéstrame el pronóstico de México F4»: VisaBot gave
// the 12-month 95 % band as 21-ene-2001 → 30-may-2001 («2001.1 a 2001.5»)
// while forecasts.csv says lo95 9536 / hi95 9696 days since 1975-01-01, i.e.
// 2001-02-09 → 2001-07-19. The grounding note sent the band as one-decimal
// years and the model converted them. The same note said «3518 pronósticos
// evaluados» next to the backfill-only 92 % coverage: n_scored mixes backfill
// and live vintages, which the scorecard says are never aggregated.
// These tests run the real path: released artifacts → chat handler → the
// request body that would reach Anthropic.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DATA_PINS } from "../lib/content/data-pins.generated.mjs";
import { resetSyntheticData } from "@/lib/visabot/synthetic-context.mjs";
import { buildPanel } from "@/lib/data/panel-core";
import { parseForecastStore, backfillScored } from "@/lib/data/forecasts-core.mjs";
import { buildForecast, chartUserNote, priorityYearTick } from "@/lib/visabot/analytics";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = (name: string) => readFileSync(join(root, "public", "data", name));
const scorecard = JSON.parse(String(dataFile("forecast_scorecard.json")));

// Expected band straight from the CSV row, converted independently of the builders.
const BASE = Date.UTC(1975, 0, 1);
const iso = (days: number) => new Date(BASE + days * 86_400_000).toISOString().slice(0, 10);
const f4 = String(dataFile("forecasts.csv"))
  .split("\n")
  .filter((l) => l.startsWith("mexico,F4,FAD,"))
  .map((l) => l.split(","))
  .sort((a, b) => a[3].localeCompare(b[3]))
  .pop()!;
const [LO95, HI95] = [iso(Number(f4[7])), iso(Number(f4[8]))];
const DECIMAL_BAND = /\[\d{4}\.\d, \d{4}\.\d\]|≈ \d{4}\.\d/;

describe("forecast grounding over the released artifacts (chat handler → Anthropic body)", () => {
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

  const ask = async (lang: "es" | "en") => {
    const { default: handler } = await import("../netlify/functions/chat.mjs");
    const res = await handler(new Request("https://visapredictai.com/.netlify/functions/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        lang, query: lang === "en" ? "Show me the Mexico F4 forecast" : "Muéstrame el pronóstico de México F4", surface: "console",
        synthetics: [{ kind: "forecast_note", country: "mexico", category: "F4", table: "FAD", release_id: DATA_PINS.releaseId }],
      }),
    }));
    expect(res.status).toBe(200);
    await res.text();
    expect(sentBodies).toHaveLength(1);
    return (JSON.parse(sentBodies[0]) as { system: string }).system;
  };

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
    it(`${lang}: the 95 % band reaches the model as exact ISO dates, never decimal years`, async () => {
      const system = await ask(lang);
      expect(system).toContain(`[${LO95}, ${HI95}]`);
      expect(system).not.toMatch(DECIMAL_BAND);
    });

    it(`${lang}: the forecast count is the backfill n that the coverage describes`, async () => {
      const system = await ask(lang);
      const n = scorecard.overall.n.toLocaleString(lang === "en" ? "en-US" : "es-MX");
      expect(system).toContain(`${n} ${lang === "en" ? "forecasts scored" : "pronósticos evaluados"}`);
      expect(system).not.toMatch(new RegExp(`\\b${scorecard.n_scored}\\b|${scorecard.n_scored.toLocaleString("en-US")}`));
    });
  }
});

describe("the same facts on the client side", () => {
  const panel = buildPanel(String(dataFile("visa_panel_long.csv")));
  const store = parseForecastStore(String(dataFile("forecasts.csv")),
    JSON.parse(String(dataFile("forecasts_meta.json"))), scorecard);
  const spec = buildForecast(panel, "mexico", "F4", "FAD", "es", 12, 48, store)!;

  it("the offline fallback summary shows the same ISO band", () => {
    const s = chartUserNote(spec, "es")!;
    expect(s).toContain(`[${LO95}, ${HI95}]`);
    expect(s).not.toMatch(DECIMAL_BAND);
  });

  it("backfillScored is overall.n, never the backfill+live total", () => {
    expect(backfillScored(scorecard)).toBe(scorecard.overall.n);
    expect(backfillScored(scorecard)).not.toBe(scorecard.n_scored);
    expect(backfillScored({ ...scorecard, overall: { ...scorecard.overall, n: undefined } })).toBeNull();
  });
});

describe("priorityYearTick (Y axis of the chart card)", () => {
  it("short spans get month + year, so ticks inside one year stay distinct", () => {
    const tick = priorityYearTick(2000.7, 2001.6, "es");
    const labels = [2000.8, 2001.0, 2001.2, 2001.4].map(tick);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[1]).toBe("ene 2001");
    expect(priorityYearTick(2000.7, 2001.6, "en")(2001.5)).toBe("Jul 2001");
  });

  it("long spans keep plain years", () => {
    expect(priorityYearTick(1995, 2005, "es")(2001.2)).toBe("2001");
  });

  it("works on the real México F4 card", () => {
    const panel = buildPanel(String(dataFile("visa_panel_long.csv")));
    const store = parseForecastStore(String(dataFile("forecasts.csv")),
      JSON.parse(String(dataFile("forecasts_meta.json"))), scorecard);
    const s = buildForecast(panel, "mexico", "F4", "FAD", "es", 12, 48, store)!;
    if (s.kind !== "forecast") throw new Error("expected forecast");
    const vals = s.data.flatMap((d) => [d.hist, d.fc, ...(d.band95 ?? [])]).filter((v): v is number => v != null);
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    expect(hi - lo).toBeLessThan(3);
    const tick = priorityYearTick(lo, hi, "es");
    const ticks = [0, 1, 2, 3, 4].map((i) => tick(lo + ((hi - lo) * i) / 4));
    expect(new Set(ticks).size).toBe(ticks.length);
  });
});
