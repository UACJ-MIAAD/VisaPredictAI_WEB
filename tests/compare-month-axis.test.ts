// The compare views (country race, pinned basket) plot months on a CATEGORICAL
// x axis: one slot per data row. A month where every series is Current or
// Unavailable has no priority date, so it produced no row and the axis
// silently skipped it. Seen on /resultados/?series=mexico|F2A|FAD (27-oct-2026):
// F2A FAD was Current for all pilot countries 2019-07→2022-07 and the ticks
// jumped 2018 → 2024. Every month between the first and last row must exist.
import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import { buildMultiLine, buildBasketCompare } from "@/lib/visabot/analytics";
import { PANEL_HEADER } from "./fixtures";

const row = (country: string, month: string, status: string, pd: string, days: string) =>
  `${country},family,F2A,FAD,${month}-01,${status},${pd},${days}`;

// two countries, dated 2019-05..06, Current 2019-07..2019-10, dated again 2019-11
const csv = [
  PANEL_HEADER,
  ...["mexico", "india"].flatMap((c) => [
    row(c, "2019-05", "F", "2017-01-01", "15341"),
    row(c, "2019-06", "F", "2017-02-01", "15372"),
    row(c, "2019-07", "C", "", ""),
    row(c, "2019-08", "C", "", ""),
    row(c, "2019-09", "C", "", ""),
    row(c, "2019-10", "C", "", ""),
    row(c, "2019-11", "F", "2019-03-01", "16130"),
  ]),
].join("\n") + "\n";
const panel = buildPanel(csv);

const expectContiguous = (months: string[]) => {
  for (let i = 1; i < months.length; i++) {
    const [y0, m0] = months[i - 1].split("-").map(Number);
    const [y1, m1] = months[i].split("-").map(Number);
    expect((y1 - y0) * 12 + (m1 - m0), `${months[i - 1]} → ${months[i]}`).toBe(1);
  }
};

describe("compare charts keep a uniform month axis", () => {
  it("buildMultiLine fills the months where every country is Current", () => {
    const s = buildMultiLine(panel, "F2A", "FAD", "es");
    if (s?.kind !== "multiline") throw new Error("expected multiline");
    const months = s.data.map((d) => String(d.month));
    expect(months[0]).toBe("2019-05");
    expect(months.at(-1)).toBe("2019-11");
    expectContiguous(months);
    // the filled months carry no values (no fabricated cutoffs)
    expect(s.data.find((d) => d.month === "2019-08")).toEqual({ month: "2019-08" });
  });

  it("buildBasketCompare fills the same gap", () => {
    const s = buildBasketCompare(panel, [
      { country: "mexico", category: "F2A", table: "FAD" },
      { country: "india", category: "F2A", table: "FAD" },
    ], "en");
    if (s?.kind !== "multiline") throw new Error("expected multiline");
    expectContiguous(s.data.map((d) => String(d.month)));
  });
});
