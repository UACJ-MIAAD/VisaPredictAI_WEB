// I2 fail-closed (auditoría 12-jul-2026): the forecast parser must return
// production_unavailable on corrupt content, not a hollow "ok" store that
// silently degrades every series to the illustrative browser drift.
import { describe, it, expect } from "vitest";
import { parseForecastStore } from "../lib/data/forecasts-core.mjs";

const HDR = "country,category,table,date,days,lo80,hi80,lo95,hi95";
const good = `${HDR}\nmexico,F1,FAD,2026-08-01,1000,900,1100,850,1150`;

describe("parseForecastStore fail-closed validation", () => {
  it("returns ok for a well-formed feed", () => {
    const s = parseForecastStore(good, {}, null);
    expect(s.status).toBe("ok");
    expect(s.series.size).toBe(1);
  });
  it("rejects a header missing required columns", () => {
    expect(parseForecastStore("a,b,c\n1,2,3", {}, null).status).toBe("production_unavailable");
  });
  it("rejects rows with non-finite days or bad dates", () => {
    const bad = `${HDR}\nmexico,F1,FAD,NOTADATE,abc,900,1100,850,1150`;
    expect(parseForecastStore(bad, {}, null).status).toBe("production_unavailable");
  });
  it("rejects a prefix-valid but non-calendar date (2026-99-99garbage)", () => {
    const bad = `${HDR}\nmexico,F1,FAD,2026-99-99garbage,1000,900,1100,850,1150`;
    expect(parseForecastStore(bad, {}, null).status).toBe("production_unavailable");
  });
  it("rejects a point forecast outside its own 95% interval", () => {
    const oob = `${HDR}\nmexico,F1,FAD,2026-08-01,5000,900,1100,850,1150`; // days>hi95
    expect(parseForecastStore(oob, {}, null).status).toBe("production_unavailable");
  });
  it("rejects inverted / incoherent prediction bands", () => {
    const inv = `${HDR}\nmexico,F1,FAD,2026-08-01,1000,1100,900,850,1150`; // lo80>hi80
    expect(parseForecastStore(inv, {}, null).status).toBe("production_unavailable");
  });
  it("rejects incompatible metadata (meta.series not an object)", () => {
    // deliberately malformed runtime input (not a valid ForecastMeta) — cast to test the guard
    const badMeta = { series: "nope" } as unknown as Parameters<typeof parseForecastStore>[1];
    expect(parseForecastStore(good, badMeta, null).status).toBe("production_unavailable");
  });
  it("drops a minority of corrupt rows but keeps the store ok", () => {
    const mixed = `${HDR}\n` +
      "mexico,F1,FAD,2026-08-01,1000,900,1100,850,1150\n" +
      "mexico,F1,FAD,2026-09-01,1010,910,1110,860,1160\n" +
      "mexico,F1,FAD,BADROW,x,1,1,1,1"; // 1 of 3 corrupt → under half
    const s = parseForecastStore(mixed, {}, null);
    expect(s.status).toBe("ok");
    expect(s.series.get("mexico|F1|FAD")?.length).toBe(2);
  });
  it("an all-header feed (zero forecasts) is a production failure, not ok", () => {
    expect(parseForecastStore(HDR, {}, null).status).toBe("production_unavailable");
  });
});

describe("parseForecastStore — audit round 2 gaps", () => {
  const HDR2 = "country,category,table,date,days,lo80,hi80,lo95,hi95";
  const g = "mexico,F1,FAD,2026-08-01,1000,900,1100,850,1150";
  it("rejects empty numeric fields instead of coercing them to zero", () => {
    const bad = `${HDR2}\nmexico,F1,FAD,2026-08-01,,900,1100,850,1150`; // empty days
    expect(parseForecastStore(bad, {}, null).status).toBe("production_unavailable");
  });
  it("counts truncated short rows as corruption (flood cannot hide behind one valid row)", () => {
    const flood = [`${HDR2}`, g, "x", "y", "z", "w"].join("\n"); // 1 valid + 4 short
    expect(parseForecastStore(flood, {}, null).status).toBe("production_unavailable");
  });
  it("a contradictory duplicate in a 2-row feed is 50% corrupt → unavailable", () => {
    const dup = `${HDR2}\n${g}\nmexico,F1,FAD,2026-08-01,2000,1800,2200,1700,2300`;
    expect(parseForecastStore(dup, {}, null).status).toBe("production_unavailable");
  });
  it("a contradictory duplicate amid enough valid rows drops only that point", () => {
    const feed = `${HDR2}\n${g}\nmexico,F1,FAD,2026-09-01,1010,910,1110,860,1160\n` +
      "mexico,F1,FAD,2026-10-01,1020,920,1120,870,1170\nmexico,F1,FAD,2026-08-01,9,9,9,9,9"; // dup contradiction
    const s = parseForecastStore(feed, {}, null); // 4 rows, 1 dropped → 25% < 50% → ok
    expect(s.status).toBe("ok");
    expect(s.series.get("mexico|F1|FAD")?.length).toBe(3);
  });
  it("keeps an identical harmless duplicate without inflating the series", () => {
    const dup = `${HDR2}\n${g}\n${g}`;
    const s = parseForecastStore(dup, {}, null);
    expect(s.status).toBe("ok");
    expect(s.series.get("mexico|F1|FAD")?.length).toBe(1);
  });
  it("rejects horizon_months = Infinity", () => {
    expect(parseForecastStore(g ? `${HDR2}\n${g}` : "", { horizon_months: Infinity } as never, null).status)
      .toBe("production_unavailable");
  });
  it("rejects a feed that is exactly 50% corrupt", () => {
    const feed = `${HDR2}\n${g}\nmexico,F1,FAD,BADDATE,x,1,1,1,1`; // 2 rows, 1 corrupt = 50%
    expect(parseForecastStore(feed, {}, null).status).toBe("production_unavailable");
  });
});
