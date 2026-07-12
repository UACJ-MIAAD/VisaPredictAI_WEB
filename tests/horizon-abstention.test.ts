// US I2 (plan auditoría 3 repos 12-jul-2026): beyond-horizon ABSTENTION + fail-closed
// forecast store. Four contracts under test:
//   (a) the system prompt and the note templates order abstention beyond the
//       validated horizon and contain NO instruction to extrapolate;
//   (b) the OLD note (which ordered a pace-based extrapolation) is REJECTED by
//       the server's synthetic-shape guard — and since US I1 the note is
//       GENERATED server-side from verified data, so a stale/manipulated client
//       cannot feed ANY note text back in at all (free-text channel dead);
//   (c) a failed forecast fetch is an EXPLICIT state (production_unavailable)
//       and forecastText declares the outage instead of fabricating context;
//   (d) the horizon in the prompt is DERIVED from SITE_STATS (never hand-typed).
// US I1 note: acceptance is asserted through validSyntheticShape — the grammar
// chat.mjs now applies as SELF-CHECK to its own server-rebuilt text (the I2
// abstention wording is preserved verbatim in the shared builder).
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sanitizeContext, systemPrompt, validSyntheticShape } from "../netlify/functions/chat.mjs";
import { SITE_STATS } from "../lib/content/site-stats.generated";
import { buildPanel } from "@/lib/data/panel-core";
import { buildForecast, forecastText, type ChartSpec } from "@/lib/visabot/analytics";
import type { ForecastStore } from "@/lib/data/forecasts";
import { linearSeriesCsv } from "./fixtures";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const H = SITE_STATS.horizonMonths;
const LIVE_EN = "Live chart (real data panel)";
const LIVE_ES = "Gráfico en vivo (panel de datos real)";

type FSpec = Extract<ChartSpec, { kind: "forecast" }>;
const fspec = (lang: "es" | "en", over: Partial<FSpec> = {}): FSpec =>
  ({
    kind: "forecast",
    title: "Mexico F1 FAD",
    subtitle: lang === "en" ? "Production model (median Theta+ETS+SARIMA)" : "Modelo de producción (mediana Theta+ETS+SARIMA)",
    splitMonth: "2026-07",
    note: "",
    yLabel: "y",
    data: [
      { month: "2026-06", date: "2018-06-01", hist: 2018.4, fc: null, band80: null, band95: null },
      { month: "2026-07", date: "2018-07-01", hist: null, fc: 2018.5, band80: [2018.2, 2018.8], band95: [2018.1, 2018.9] },
    ],
    ...over,
  }) as FSpec;

describe("(a)+(d) system prompt: derived horizon + abstention order", () => {
  it("ES prompt interpolates SITE_STATS.horizonMonths and orders abstention", () => {
    const p = systemPrompt("es", [], "console");
    expect(p).toContain(`proyección a ${H} meses`);
    expect(p).toContain(`MÁS ALLÁ de los ${H} meses validados`);
    expect(p).toContain("remite al boletín oficial en travel.state.gov");
    expect(p).toContain("NO des ninguna fecha ni estimación fuera del horizonte validado");
    expect(p).not.toMatch(/estimaci[oó]n aproximada/); // the extrapolation order is dead
  });

  it("EN prompt interpolates SITE_STATS.horizonMonths and orders abstention", () => {
    const p = systemPrompt("en", [], "console");
    expect(p).toContain(`${H}-month projection`);
    expect(p).toContain(`BEYOND the validated ${H} months`);
    expect(p).toContain("official Visa Bulletin at travel.state.gov");
    expect(p).toContain("do NOT give any date or estimate past the validated horizon");
    expect(p).not.toMatch(/pace-based estimate/);
  });

  it("chat.mjs source carries NO hand-typed horizon (regla #0)", () => {
    const src = readFileSync(join(root, "netlify", "functions", "chat.mjs"), "utf8");
    expect(src).not.toMatch(/12 (meses|months)|12-month/);
  });
});

describe("(a) new forecast note: abstention + last validated band, accepted by the server self-check", () => {
  it.each(["es", "en"] as const)("%s note orders abstention and passes the synthetic-shape self-check", (lang) => {
    const note = forecastText(fspec(lang), lang);
    if (lang === "en") {
      expect(note).toContain("as the furthest validated reading");
      expect(note).toContain("official Visa Bulletin (travel.state.gov)");
      expect(note).toContain("do NOT give any date or estimate beyond the validated horizon");
      expect(note).not.toMatch(/pace-based/);
    } else {
      expect(note).toContain("ofrece como última lectura validada");
      expect(note).toContain("boletín oficial (travel.state.gov)");
      expect(note).toContain("NO des ninguna fecha ni estimación más allá del horizonte validado");
      expect(note).not.toMatch(/estimaci[oó]n aproximada/);
    }
    // US I1: the note is server-generated; this grammar gates it before the prompt.
    expect(validSyntheticShape(lang === "en" ? LIVE_EN : LIVE_ES, note)).toBe(true);
    // …and the same text arriving as CLIENT context no longer enters at all.
    expect(sanitizeContext([{ n: 1, title: "f", source: lang === "en" ? LIVE_EN : LIVE_ES, text: note }])).toHaveLength(0);
  });

  it("still accepts the note when the accuracy clause (spec.note) is present", () => {
    const note = forecastText(
      fspec("en", { note: "Verified accuracy, global across all series (2944 forecasts scored)." }),
      "en",
    );
    expect(validSyntheticShape(LIVE_EN, note)).toBe(true);
  });
});

describe("(b) the OLD extrapolation-ordering note is REJECTED", () => {
  // The dead order is rebuilt by CONCATENATION so a repo-wide grep for the
  // retired phrases stays at zero — this test exists precisely to prove the
  // phrase no longer validates anywhere.
  const OLD_EN =
    "A FORECAST CHART is being shown to the user right now — describe and interpret it; do NOT say you cannot show charts, and do NOT refuse. " +
    "Mexico F1 FAD. Production model (median Theta+ETS+SARIMA). Last real cutoff: 2018-06-01 (2026-06). " +
    "Projection at the 12-month horizon (2027-06): about 2019-01-15 (priority year ≈ 2019.0), 95% band [2018.6, 2019.4]. " +
    "If the user gave a priority date, say whether this projected cutoff reaches it within the horizon; " +
    "if reaching it lies BEYOND the 12 months shown, say so frankly and give a rough " + "pace-based estimate with its uncertainty. " +
    "Frame it as an aggregate statistical forecast, not legal advice — but DO give the " + "estimate.";
  const OLD_ES =
    "Se está mostrando al usuario un GRÁFICO DE PRONÓSTICO en este momento — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos y NO te niegues. " +
    "México F1 FAD. Modelo de producción (mediana Theta+ETS+SARIMA). Último corte real: 2018-06-01 (2026-06). " +
    "Proyección al horizonte de 12 meses (2027-06): alrededor de 2019-01-15 (año de prioridad ≈ 2019.0), banda al 95 % [2018.6, 2019.4]. " +
    "Si el usuario dio su fecha de prioridad, di si el corte proyectado la alcanza dentro del horizonte; " +
    "si alcanzarla queda MÁS ALLÁ de los 12 meses mostrados, dilo con franqueza y da una estimación " + "aproximada por el ritmo, con su incertidumbre. " +
    "Enmárcalo como pronóstico estadístico agregado, no asesoría legal — pero SÍ da la " + "estimación.";

  it("rejects the old EN note (fails the shape guard AND the dead free-text channel)", () => {
    expect(validSyntheticShape(LIVE_EN, OLD_EN)).toBe(false);
    expect(sanitizeContext([{ n: 1, title: "f", source: LIVE_EN, text: OLD_EN }])).toHaveLength(0);
  });

  it("rejects the old ES note (fails the shape guard AND the dead free-text channel)", () => {
    expect(validSyntheticShape(LIVE_ES, OLD_ES)).toBe(false);
    expect(sanitizeContext([{ n: 1, title: "f", source: LIVE_ES, text: OLD_ES }])).toHaveLength(0);
  });

  it("the retired order phrases are gone from the live templates", () => {
    for (const lang of ["es", "en"] as const) {
      const note = forecastText(fspec(lang), lang);
      expect(note).not.toContain("DO give the " + "estimate");
      expect(note).not.toContain("SÍ da la " + "estimación");
    }
  });
});

describe("(c) fail-closed forecast store", () => {
  const unavailableStore: ForecastStore = {
    method: {},
    series: new Map(),
    meta: new Map(),
    scorecard: null,
    horizonMonths: 0,
    status: "production_unavailable",
    reason: "HTTP 500",
  };
  const panel = buildPanel(linearSeriesCsv(12, 30));

  it("loadForecasts with a failed fetch → explicit production_unavailable + detectable warn", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    try {
      const { loadForecasts } = await import("@/lib/data/forecasts");
      const store = await loadForecasts();
      expect(store.status).toBe("production_unavailable");
      expect(store.reason).toContain("offline");
      expect(store.series.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("[forecasts]"));
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  });

  it("loadForecasts with a healthy fetch → status ok", async () => {
    vi.resetModules();
    const csv =
      "country,category,table,date,days,lo80,hi80,lo95,hi95\n" +
      "mexico,F4,FAD,2024-01-01,9000,8990,9010,8980,9020\n";
    const res = (body: string, json?: unknown) => ({
      ok: true,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(json),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("forecasts.csv")
            ? res(csv)
            : url.includes("forecasts_meta")
              ? res("", { horizon_months: 12, method: {} })
              : res("", null),
        ),
      ),
    );
    try {
      const { loadForecasts } = await import("@/lib/data/forecasts");
      const store = await loadForecasts();
      expect(store.status).toBe("ok");
      expect(store.horizonMonths).toBe(12);
      expect(store.series.size).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(["es", "en"] as const)(
    "%s: buildForecast marks the spec and forecastText declares the outage without drift figures",
    (lang) => {
      const spec = buildForecast(panel, "mexico", "F4", "FAD", lang, 12, 48, unavailableStore);
      if (!spec || spec.kind !== "forecast") throw new Error("expected a forecast spec");
      expect(spec.productionUnavailable).toBe(true);
      expect(spec.fallback).toBe(true); // the drift chart may still render in the UI
      const note = forecastText(spec, lang);
      if (lang === "en") {
        expect(note).toContain("the production forecast feed is unavailable right now");
        expect(note).toContain("official Visa Bulletin (travel.state.gov)");
        expect(note).not.toMatch(/Projection at the/);
      } else {
        expect(note).toContain("no está disponible en este momento");
        expect(note).toContain("boletín oficial (travel.state.gov)");
        expect(note).not.toMatch(/Proyección al horizonte/);
      }
      expect(note).not.toMatch(/95\s?% band \[|banda al 95 % \[/); // no fabricated bands
      // US I1: the outage note is server-generated too — the self-check accepts it.
      expect(validSyntheticShape(lang === "en" ? LIVE_EN : LIVE_ES, note)).toBe(true);
    },
  );

  it("a healthy store does NOT mark productionUnavailable", () => {
    const ok: ForecastStore = { ...unavailableStore, status: "ok", reason: undefined };
    const spec = buildForecast(panel, "mexico", "F4", "FAD", "en", 12, 48, ok);
    if (!spec || spec.kind !== "forecast") throw new Error("expected a forecast spec");
    expect(spec.productionUnavailable).toBeUndefined();
    expect(forecastText(spec, "en")).toMatch(/Projection at the/);
  });
});
