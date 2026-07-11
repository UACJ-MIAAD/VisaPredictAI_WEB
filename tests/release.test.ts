// B2: consumo del manifiesto de release — mapeo, verificación SHA-256, decisión de
// swap atómico y estados fresh/stale/incompatible/legacy.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { MANIFEST_PATH, SUPPORTED_SCHEMA, consumedEntries, outFor, planSwap, releaseState, verifyEntry } from "../lib/release.mjs";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("outFor — repo path → public/data name", () => {
  it("maps the 11 base artifacts to their legacy out names", () => {
    expect(outFor("data/processed/visa_panel_long.csv")).toBe("visa_panel_long.csv");
    expect(outFor("reports/prospective/web_forecasts.csv")).toBe("forecasts.csv");
    expect(outFor("reports/prospective/forecast_scorecard_meta.json")).toBe("forecast_scorecard.json");
    expect(outFor("reports/eda/en/eda_report.pdf")).toBe("eda_report_en.pdf");
    expect(outFor("reports/fe/fe_facts.json")).toBe("fe_facts.json");
  });
  it("maps all four gallery variants for EDA and FE", () => {
    expect(outFor("reports/eda/gallery/g01_panel.png")).toBe("eda/g01_panel.png");
    expect(outFor("reports/eda/gallery/dark/g01_panel.png")).toBe("eda/dark/g01_panel.png");
    expect(outFor("reports/fe/gallery/en/f07_pipeline.png")).toBe("fe/en/f07_pipeline.png");
    expect(outFor("reports/fe/gallery/en/dark/f07_pipeline.png")).toBe("fe/en/dark/f07_pipeline.png");
  });
  it("returns null for release artifacts the site build does not consume", () => {
    expect(outFor("reports/prospective/forecast_log.csv")).toBeNull();
    expect(outFor("reports/governance/MODEL_CARD.md")).toBeNull();
    expect(outFor("reports/governance/key_facts.json")).toBeNull();
  });
});

describe("verifyEntry", () => {
  const body = Buffer.from("hola panel");
  const entry = { path: "x", out: "x", sha256: sha("hola panel"), size: body.length, criticality: "critical" };
  it("passes on matching bytes", () => {
    expect(verifyEntry(entry, body)).toBe(true);
  });
  it("rejects a size mismatch and a content mismatch", () => {
    expect(verifyEntry(entry, Buffer.from("hola"))).toMatch(/size/);
    expect(verifyEntry(entry, Buffer.from("hola PANEL"))).toBe("sha256 mismatch"); // mismo tamaño, otros bytes
  });
});

describe("planSwap — atomicity decision", () => {
  const entries = [
    { out: "a.csv", criticality: "critical" },
    { out: "b.json", criticality: "required" },
    { out: "c.png", criticality: "optional" },
  ];
  it("swaps only when every blocking artifact verified", () => {
    const all = new Map<string, true | string>([["a.csv", true], ["b.json", true], ["c.png", true]]);
    expect(planSwap(entries, all)).toMatchObject({ swap: true, status: "fresh", missingOptional: [] });
  });
  it("a failed optional degrades but does not block", () => {
    const res = new Map<string, true | string>([["a.csv", true], ["b.json", true], ["c.png", "HTTP 404"]]);
    const p = planSwap(entries, res);
    expect(p.swap).toBe(true);
    expect(p.missingOptional[0]).toContain("c.png");
  });
  it("a failed critical or required vetoes the whole swap", () => {
    for (const bad of ["a.csv", "b.json"]) {
      const results = new Map<string, true | string>(
        entries.map((e) => [e.out, e.out === bad ? "sha256 mismatch" : true]),
      );
      const p = planSwap(entries, results);
      expect(p).toMatchObject({ swap: false, status: "stale" });
      expect(p.reason).toContain(bad);
    }
  });
  it("an entry never fetched counts as blocking too", () => {
    const partial = new Map<string, true | string>([["a.csv", true], ["c.png", true]]);
    const p = planSwap(entries, partial);
    expect(p.swap).toBe(false);
    expect(p.reason).toContain("b.json");
  });
});

describe("consumedEntries + releaseState", () => {
  it("filters the manifest to the consumed set with out names", () => {
    const manifest = {
      schema_version: SUPPORTED_SCHEMA,
      artifacts: [
        { path: "data/processed/visa_panel_long.csv", sha256: "x", size: 1, criticality: "critical" },
        { path: "reports/eda/gallery/dark/g02_trayectorias.png", sha256: "y", size: 2, criticality: "optional" },
        { path: "reports/prospective/forecast_log_shadow.csv", sha256: "z", size: 3, criticality: "required" },
      ],
    };
    const got = consumedEntries(manifest);
    expect(got.map((e: { out: string }) => e.out)).toEqual(["visa_panel_long.csv", "eda/dark/g02_trayectorias.png"]);
  });
  it("release state carries identity and the four statuses", () => {
    const manifest = { release_id: "2026-07-abc", panel_vintage: "2026-07", generated_at: "t" };
    const s = releaseState({ status: "fresh", manifest, missingOptional: ["x"] });
    expect(s).toMatchObject({ status: "fresh", release_id: "2026-07-abc", panel_vintage: "2026-07", missing_optional: ["x"] });
    for (const status of ["stale", "incompatible", "legacy"]) {
      expect(releaseState({ status }).status).toBe(status);
    }
  });
  it("pins the manifest path and schema the loader supports", () => {
    expect(MANIFEST_PATH).toBe("reports/release/release_manifest.json");
    expect(SUPPORTED_SCHEMA).toBe(1);
  });
});
