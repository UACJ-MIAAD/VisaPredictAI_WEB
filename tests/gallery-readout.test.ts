import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPanel } from "@/lib/data/panel-core.mjs";
import { parseForecastStore, forecastFor } from "@/lib/data/forecasts-core.mjs";
import { buildForecast, buildPanelIndex } from "@/lib/visabot/analytics";
import { seriesReadout } from "@/lib/visabot/gallery";

const file = (n: string) => readFileSync(`public/data/${n}`, "utf8");
const panel = buildPanel(file("visa_panel_long.csv"));
const store = parseForecastStore(file("forecasts.csv"), JSON.parse(file("forecasts_meta.json")), null);
const index = buildPanelIndex(panel);

describe("seriesReadout", () => {
  it("prints the latest published cell and agrees with the fan chart's last projected point, for every shipped series", () => {
    let checked = 0;
    for (const key of store.series.keys()) {
      const [country, category, table] = key.split("|");
      const rows = index.get(key) ?? [];
      const points = forecastFor(store, country, category, table);
      const r = seriesReadout(rows, points);
      const last = [...rows].sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth)).at(-1)!;
      expect(r.current).toEqual({ month: last.bulletinMonth, status: last.status, date: last.status === "F" ? last.priorityDate : null });
      const spec = buildForecast(panel, country, category, table, "es", store.horizonMonths, 48, store, index);
      const ends = points?.at(-1)?.date.slice(0, 7);
      if (ends && ends <= last.bulletinMonth) { expect(r.projected).toBeNull(); continue; }
      if (!r.projected || spec?.kind !== "forecast") continue;
      const end = spec.data.at(-1) as { date?: string };
      expect(r.projected.date).toBe(end.date);
      expect(r.projected.lo95 <= r.projected.date && r.projected.date <= r.projected.hi95).toBe(true);
      expect(r.projected.months).toBe(points!.length);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("has no projection without a dated observation or without forecast points", () => {
    expect(seriesReadout([], null)).toEqual({ current: null, projected: null });
    const rows = [{ country: "x", category: "F1", table: "FAD", bulletinMonth: "2026-01", status: "C", priorityDate: null, daysSinceBase: null }];
    expect(seriesReadout(rows as never, [{ date: "2026-02-01", days: 1, lo80: 0, hi80: 2, lo95: 0, hi95: 2 }]).projected).toBeNull();
  });
});
