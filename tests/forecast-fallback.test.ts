// BB5 regression net: buildForecast must keep behaving exactly like before the
// fitDrift/driftBands extraction when no pre-generated forecast exists (the
// in-browser drift fallback) and must refuse series too short to anchor.
import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import { buildForecast, bandOf } from "@/lib/visabot/analytics";
import { linearSeriesCsv } from "./fixtures";

const panel = buildPanel(linearSeriesCsv(12, 30)); // 12 F months, +30 d/month

function fallbackSpec() {
  const spec = buildForecast(panel, "mexico", "F4", "FAD", "es", 12, 48, null);
  if (!spec || spec.kind !== "forecast") throw new Error("expected a forecast spec");
  return spec;
}

describe("buildForecast (drift fallback, no ForecastStore)", () => {
  it("returns a forecast spec labelled as the in-browser drift baseline", () => {
    const spec = fallbackSpec();
    expect(spec.subtitle).toMatch(/deriva en el navegador/);
    expect(spec.subtitle).toMatch(/avanzando/); // positive drift
    expect(spec.note).toBeUndefined(); // no scorecard shipped
  });

  it("splits at the last observed month and appends exactly `horizon` points", () => {
    const spec = fallbackSpec();
    expect(spec.splitMonth).toBe("2023-12");
    expect(spec.data).toHaveLength(12 + 12); // window + horizon
    expect(spec.data[12].month).toBe("2024-01");
    expect(spec.data[23].month).toBe("2024-12");
  });

  it("projects a monotonically advancing forecast for a linearly advancing series", () => {
    const fc = fallbackSpec().data.filter((d) => d.fc != null && d.hist == null);
    for (let i = 1; i < fc.length; i++)
      expect(fc[i].fc as number).toBeGreaterThan(fc[i - 1].fc as number);
  });

  it("keeps bands centered and non-crossing at every horizon", () => {
    for (const d of fallbackSpec().data.filter((x) => x.hist == null)) {
      const [lo95, hi95] = bandOf(d.band95);
      const [lo80, hi80] = bandOf(d.band80);
      expect(lo95).toBeLessThanOrEqual(lo80);
      expect(lo80).toBeLessThanOrEqual(d.fc as number);
      expect(d.fc as number).toBeLessThanOrEqual(hi80);
      expect(hi80).toBeLessThanOrEqual(hi95);
    }
  });

  it("refuses series with fewer than 8 F observations (honest null)", () => {
    const short = buildPanel(linearSeriesCsv(7, 30));
    expect(buildForecast(short, "mexico", "F4", "FAD", "es", 12, 48, null)).toBeNull();
  });
});
