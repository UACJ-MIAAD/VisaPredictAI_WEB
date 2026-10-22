import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { censusValues, renderCensus } from "../lib/census-bindings.mjs";

const facts = JSON.parse(readFileSync("public/data/key_facts.json", "utf8"));
const eda = JSON.parse(readFileSync("public/data/eda_facts.json", "utf8"));

describe("census bindings from a verified cut", () => {
  it("renders the actual cut and every source binding without a stale fallback", () => {
    const values = censusValues(facts, eda);
    expect(renderCensus("{{census:n_obs:comma}} / {{census:n_months}} / {{census:date_last}}", values)).toBe(`${facts.n_obs.toLocaleString("en-US")} / ${facts.n_months} / ${facts.date_last}`);
    for (const path of ["content/source.html", "content/en/datos.html", "content/en/eda.html"]) {
      expect(renderCensus(readFileSync(path, "utf8"), values)).not.toContain("{{census:");
    }
  });
  it("changes the emitted census when a new cut arrives", () => {
    const values = censusValues(facts, eda);
    expect(renderCensus("{{census:n_obs:comma}} observations", { ...values, n_obs: values.n_obs + 150 })).toBe(`${(facts.n_obs + 150).toLocaleString("en-US")} observations`);
  });
  it.each(["{{census:typo}}", "{{census:n_obs:invalid}}", "{{census:date_last:comma}}"])("rejects unknown or malformed binding %s", (source) => {
    expect(() => renderCensus(source, censusValues(facts, eda))).toThrow();
  });
  it("rejects a cross-cut or incomplete census", () => {
    const changed = structuredClone(eda);
    changed.panel.n_obs += 1;
    expect(() => censusValues(facts, changed)).toThrow("inconsistent");
    expect(() => censusValues(facts, { ...eda, series: eda.series.slice(1) })).toThrow("census");
    expect(() => censusValues({ ...facts, n_obs: true }, eda)).toThrow("invalid");
  });
});
