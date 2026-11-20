import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPanel } from "@/lib/data/panel-core.mjs";
import { parseForecastStore, forecastFor } from "@/lib/data/forecasts-core.mjs";
import { buildForecast, buildPanelIndex } from "@/lib/visabot/analytics";
import { seriesReadout, reachVerdict, filterSeries, buildGallerySeries, forecastToCsv, maseVsNaive, capPoints, categoryName, categoryCode } from "@/lib/visabot/gallery";
import { isoDays } from "@/lib/visabot/synthetic-builders.mjs";
import type { ForecastPoint } from "@/lib/data/forecasts";

const file = (n: string) => readFileSync(`public/data/${n}`, "utf8");
const panel = buildPanel(file("visa_panel_long.csv"));
const store = parseForecastStore(file("forecasts.csv"), JSON.parse(file("forecasts_meta.json")), null);
const index = buildPanelIndex(panel);

// Synthetic series: F cutoffs in 2026-01..03 (base = 2000-01-01), then a given last cell.
const BASE = "2000-01-01";
const row = (m: string, status: string, date: string | null) => ({
  country: "mexico", category: "F1", table: "FAD", bulletinMonth: m, status,
  priorityDate: date, daysSinceBase: date ? isoDays(date) - isoDays(BASE) : null,
});
const F = [row("2026-01", "F", "2010-01-01"), row("2026-02", "F", "2010-02-01"), row("2026-03", "F", "2010-03-01")];
const pts = (from: string): ForecastPoint[] => [0, 1, 2].map((i) => {
  const days = isoDays("2010-04-01") - isoDays(BASE) + i * 60;
  return { date: `${from.slice(0, 5)}${String(Number(from.slice(5, 7)) + i).padStart(2, "0")}-01`, days, lo80: days - 30, hi80: days + 30, lo95: days - 90, hi95: days + 90 };
});

describe("seriesReadout", () => {
  it("agrees with the fan chart's last projected point for every shipped series it projects", () => {
    let checked = 0;
    for (const key of store.series.keys()) {
      const [country, category, table] = key.split("|");
      const rows = index.get(key) ?? [];
      const r = seriesReadout(rows, forecastFor(store, country, category, table), panel.monthRange[1]);
      const last = [...rows].sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth)).at(-1)!;
      expect(r.current).toEqual({ month: last.bulletinMonth, status: last.status, date: last.status === "F" ? last.priorityDate : null });
      if (last.status !== "F" || last.bulletinMonth < panel.monthRange[1]) expect(r.projected).toBeNull();
      if (!r.projected) continue;
      const spec = buildForecast(panel, country, category, table, "es", store.horizonMonths, 48, store, index);
      expect(spec?.kind).toBe("forecast");
      expect(r.projected.date).toBe((spec as unknown as { data: { date?: string }[] }).data.at(-1)!.date);
      expect(r.projected.lo95 <= r.projected.date && r.projected.date <= r.projected.hi95).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("projects nothing once the category is Current or Unavailable, even with an older F anchor and a future horizon", () => {
    expect(seriesReadout([...F, row("2026-04", "C", null)] as never, pts("2026-05-01"))).toMatchObject({ projected: null, none: "current" });
    expect(seriesReadout([...F, row("2026-04", "U", null)] as never, pts("2026-05-01"))).toMatchObject({ projected: null, none: "unavailable" });
  });

  it("projects nothing for a series missing from the latest bulletin", () => {
    expect(seriesReadout(F as never, pts("2026-04-01"), "2026-11")).toMatchObject({ projected: null, none: "discontinued" });
    expect(reachVerdict(seriesReadout(F as never, pts("2026-04-01"), "2026-11"), pts("2026-04-01"), "2030-01-01").status).toBe("discontinued");
  });

  it("projects nothing from a forecast fit before the latest bulletin", () => {
    expect(seriesReadout(F as never, pts("2026-02-01"))).toMatchObject({ projected: null, none: "stale" });
    expect(seriesReadout(F as never, null)).toMatchObject({ projected: null, none: "noForecast" });
    expect(seriesReadout(F as never, pts("2026-04-01")).projected).toMatchObject({ month: "2026-06", date: "2010-07-30" });
  });
});

describe("reachVerdict", () => {
  const r = seriesReadout(F as never, pts("2026-04-01"));
  const p = pts("2026-04-01");
  it("states the central month and the 95 % range of months", () => {
    expect(reachVerdict(r, p, "2010-05-15")).toEqual({ status: "within", central: "2026-05", early: "2026-04", late: null, last: "2026-06" });
  });
  it("separates 'only the optimistic edge reaches it' from 'nothing reaches it'", () => {
    expect(reachVerdict(r, p, "2010-09-15")).toMatchObject({ status: "band", central: null, early: "2026-06" });
    expect(reachVerdict(r, p, "2015-01-01")).toMatchObject({ status: "beyond", early: null, last: "2026-06" });
  });
  it("a date equal to the published cutoff is not yet reached (only earlier dates are)", () => {
    expect(reachVerdict(r, p, "2010-03-01").status).not.toBe("past");
    expect(reachVerdict(r, p, "2010-02-28").status).toBe("past");
  });
  it("a central path that passes the date and is behind it again by the end is not 'within'", () => {
    const back = pts("2026-04-01").map((q, i) => (i === 2 ? { ...q, days: q.days - 200 } : q));
    const rb = seriesReadout(F as never, back);
    expect(reachVerdict(rb, back, "2010-05-15")).toMatchObject({ status: "crossedBack", central: "2026-05" });
    expect(rb.projected?.retro).toBe(true);
  });
  it("marks bounds that reach the bulletin's own month as Current", () => {
    const wide = pts("2026-04-01").map((q) => ({ ...q, hi95: isoDays("2027-01-01") - isoDays(BASE) }));
    expect(seriesReadout(F as never, wide).projected).toMatchObject({ hi95Current: true, dateCurrent: false });
  });
  it("handles past dates, Current, Unavailable, stale forecasts and bad input", () => {
    expect(reachVerdict(r, p, "2009-01-01").status).toBe("past");
    expect(reachVerdict(seriesReadout([...F, row("2026-04", "C", null)] as never, p), p, "2030-01-01").status).toBe("current");
    expect(reachVerdict(seriesReadout([...F, row("2026-04", "U", null)] as never, p), p, "2030-01-01").status).toBe("unavailable");
    expect(reachVerdict(seriesReadout(F as never, pts("2026-02-01")), p, "2030-01-01").status).toBe("noForecast");
    expect(reachVerdict(r, p, "2010-02-30").status).toBe("invalid");
  });
});

describe("filterSeries search", () => {
  const all = buildGallerySeries(store);
  const keys = (q: string) => filterSeries(all, { query: q }).map((s) => s.key);
  it("matches labels with or without accents, short codes, hyphens and any word order", () => {
    expect(keys("México F4").length).toBeGreaterThan(0);
    expect(keys("mexico f4")).toEqual(keys("F4 México"));
    expect(keys("Filipinas F4").every((k) => k.startsWith("philippines|F4"))).toBe(true);
    expect(keys("EB-2 India")).toEqual(keys("india eb2"));
    expect(keys("RoW F1").every((k) => k.startsWith("all_chargeability|F1"))).toBe(true);
  });
});

describe("forecastToCsv / maseVsNaive", () => {
  it("adds ISO cutoff columns when the base is known", () => {
    const csv = forecastToCsv("mexico|F1|FAD", pts("2026-04-01"), isoDays(BASE)).split("\n");
    expect(csv[0]).toBe("series,date,days,lo80,hi80,lo95,hi95,cutoff,lo80_date,hi80_date,lo95_date,hi95_date");
    expect(csv[1].split(",")[7]).toBe("2010-04-01");
  });
  it("judges MASE against the naive forecast, not against the page", () => {
    expect([maseVsNaive(0.42), maseVsNaive(1.02), maseVsNaive(null)]).toEqual(["beats", "loses", null]);
  });
});

describe("capPoints / band edges", () => {
  const base = isoDays(BASE);
  it("caps every value at its own bulletin month (a later cutoff would be Current)", () => {
    const far = pts("2026-04-01").map((q) => ({ ...q, hi95: isoDays("2040-01-01") - base, days: isoDays("2030-01-01") - base }));
    const capped = capPoints(far, base)!;
    capped.forEach((q) => {
      const cap = isoDays(`${q.date.slice(0, 7)}-01`) - base;
      expect(q.hi95).toBe(cap);
      expect(q.days).toBe(cap);
    });
    const csv = forecastToCsv("x", far, base).split("\n")[1].split(",");
    expect(csv[7]).toBe("C");
  });
  it("an optimistic edge that touches the date and falls back does not count", () => {
    const r = seriesReadout(F as never, pts("2026-04-01"));
    const p = pts("2026-04-01").map((q, i) => (i === 1 ? { ...q, hi95: q.hi95 + 400 } : { ...q, hi95: q.days }));
    expect(reachVerdict(r, p, "2010-10-01")).toMatchObject({ status: "beyond", early: null });
  });
});

describe("category names", () => {
  it("names every category shipped in the panel (no bare codes) in both languages", () => {
    for (const c of panel.categories) {
      expect(categoryName(c, "es")).not.toBe(categoryCode(c));
      expect(categoryName(c, "en")).not.toBe(categoryCode(c));
    }
    expect(categoryCode("EB5_HIGHUNEMP")).toBe("EB5 HIGHUNEMP");
    expect(categoryName("ZZ_NEW", "es")).toBe("ZZ NEW");
  });
  it("search matches the names in either language", () => {
    const all = buildGallerySeries(store);
    const keys = (q: string) => filterSeries(all, { query: q }).map((s) => s.key);
    expect(keys("otros trabajadores").every((k) => k.includes("|EB3_OW|"))).toBe(true);
    expect(keys("other workers")).toEqual(keys("otros trabajadores"));
  });
});
