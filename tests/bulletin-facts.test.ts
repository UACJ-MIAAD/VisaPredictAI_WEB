import { describe, expect, it } from "vitest";
import { bulletinFactText } from "@/lib/visabot/bulletin-facts.mjs";

// Demo rehearsal (15-nov-2026): the latest-bulletin fact listed the first 12
// advances in feed order with no magnitude; the model called them highlights
// and relabelled "F4 DFF (01NOV12)" as EB4.
const rows = [
  { country: "all_chargeability", category: "EB2", table: "FAD", raw_value: "01APR25", delta_days: 31 },
  { country: "all_chargeability", category: "EB4", table: "DFF", raw_value: "01JAN25", delta_days: 0 },
  { country: "all_chargeability", category: "F4", table: "FAD", raw_value: "22OCT12", delta_days: 366 },
  { country: "mexico", category: "EB3_OW", table: "FAD", raw_value: "01JUN22", delta_days: 151 },
  { country: "india", category: "F2B", table: "FAD", raw_value: "22AUG20", delta_days: null },
];
const name = (c: string) => ({ all_chargeability: "Resto del mundo", mexico: "México", india: "India" })[c] ?? c;

describe("bulletinFactText", () => {
  const t = bulletinFactText(rows, "noviembre 2026", "es", name);

  it("orders advances by magnitude and gives each one its days", () => {
    expect(t).toMatch(/Mayores avances \(ordenados por días\): Resto del mundo F4 FAD: 22OCT12 \(\+366 días\); México EB3_OW FAD: 01JUN22 \(\+151 días\); Resto del mundo EB2 FAD: 01APR25 \(\+31 días\)\./);
  });

  it("never lists a series that did not move", () => {
    expect(t).not.toMatch(/EB4/);
  });

  it("states counts, an explicit 'ninguno' and a pilot-country line", () => {
    expect(t).toMatch(/Se publicaron 5 series\. Avanzaron 3, retrocedieron 0 y 2 no se movieron o no tienen fecha\./);
    expect(t).toMatch(/Mayores retrocesos: ninguno\./);
    expect(t).toMatch(/Movimientos de México: México EB3_OW FAD: 01JUN22 \(\+151 días\)\./);
  });

  it("has an English twin", () => {
    expect(bulletinFactText(rows, "November 2026", "en", (c) => c)).toMatch(/Largest retrogressions: none\./);
  });
});
