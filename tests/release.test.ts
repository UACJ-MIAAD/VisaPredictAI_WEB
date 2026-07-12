// B2: consumo del manifiesto de release — mapeo, verificación SHA-256, decisión de
// swap atómico y estados fresh/stale/incompatible/legacy.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { MANIFEST_PATH, SUPPORTED_SCHEMA, consumedEntries, executeSwap, outFor, planSwap, releaseState, swapDisposition, verifyEntry } from "../lib/release.mjs";

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

describe("releaseState — provenance of the SERVED bytes (author audit 11-jul)", () => {
  const next = { release_id: "2026-07-new", panel_vintage: "2026-07", generated_at: "t2" };
  const prev = { release_id: "2026-06-old", panel_vintage: "2026-06", generated_at: "t1" };
  it("stale attributes the kept bytes to the PREVIOUS release, refused id apart", () => {
    const s = releaseState({ status: "stale", manifest: next, previous: prev, reason: "blocking failed" });
    expect(s.release_id).toBe("2026-06-old");
    expect(s.panel_vintage).toBe("2026-06");
    expect(s.rejected_release_id).toBe("2026-07-new");
  });
  it("incompatible follows the same rule", () => {
    const s = releaseState({ status: "incompatible", manifest: next, previous: prev });
    expect(s.release_id).toBe("2026-06-old");
    expect(s.rejected_release_id).toBe("2026-07-new");
  });
  it("fresh serves the new manifest and rejects nothing", () => {
    const s = releaseState({ status: "fresh", manifest: next, previous: prev });
    expect(s.release_id).toBe("2026-07-new");
    expect(s.rejected_release_id).toBeNull();
  });
  it("stale without a previous state degrades to null, never the refused id", () => {
    const s = releaseState({ status: "stale", manifest: next });
    expect(s.release_id).toBeNull();
    expect(s.rejected_release_id).toBe("2026-07-new");
  });
});

describe("executeSwap — transactional with rollback (author audit 11-jul)", () => {
  // In-memory fs: files es un Set de rutas existentes; rename mueve, rm borra prefijos.
  function memFs(files: Set<string>, failOnRename?: string) {
    return {
      calls: [] as string[],
      rename: async (a: string, b: string) => {
        if (failOnRename && a === failOnRename) throw new Error(`EIO ${a}`);
        if (!files.has(a)) throw new Error(`ENOENT ${a}`);
        files.delete(a);
        files.add(b);
      },
      mkdir: async () => {},
      rm: async (p: string) => {
        for (const f of [...files]) if (f === p || f.startsWith(p + "/")) files.delete(f);
      },
      exists: async (p: string) => files.has(p),
    };
  }
  const entries = [{ out: "a.csv" }, { out: "b.json" }, { out: "c.png" }];
  const results = new Map<string, true | string>([["a.csv", true], ["b.json", true], ["c.png", true]]);
  const ctx = { out: "out", staging: "stg", backup: "bak", joinPath: (...p: string[]) => p.join("/"), dirOf: (p: string) => p.split("/").slice(0, -1).join("/") };

  it("success: every winner lands, backup cleaned", async () => {
    const files = new Set(["out/a.csv", "out/b.json", "stg/a.csv", "stg/b.json", "stg/c.png"]);
    const fs = memFs(files);
    const r = await executeSwap(entries, results, { ...ctx, fs });
    expect(r).toMatchObject({ swapped: 3, rolledBack: false });
    expect([...files].sort()).toEqual(["out/a.csv", "out/b.json", "out/c.png"]);
  });
  it("mid-flight failure rolls the WHOLE previous cut back (no hybrid)", async () => {
    const files = new Set(["out/a.csv", "out/b.json", "stg/a.csv", "stg/b.json", "stg/c.png"]);
    const fs = memFs(files, "stg/b.json"); // phase B falla en el 2o archivo: a.csv ya colocado
    const r = await executeSwap(entries, results, { ...ctx, fs });
    expect(r.rolledBack).toBe(true);
    expect(files.has("out/a.csv")).toBe(true);   // el viejo a.csv RESTAURADO, no el staged
    expect(files.has("out/b.json")).toBe(true);  // b.json intacto
    expect(files.has("out/c.png")).toBe(false);  // el artefacto nuevo no quedo a medias
    expect([...files].some((f) => f.startsWith("bak/"))).toBe(false);
  });
  it("wounded ROLLBACK is fail-closed: reports unrecovered and PRESERVES the backup", async () => {
    // 2a ronda audit: heridas fase B (b.json) Y la restauracion de a.csv — antes esto
    // devolvia rolledBack:true, borraba el backup y a.csv desaparecia para siempre.
    const files = new Set(["out/a.csv", "out/b.json", "stg/a.csv", "stg/b.json", "stg/c.png"]);
    const fs = memFs(files, "stg/b.json");
    const innerRename = fs.rename;
    fs.rename = async (a: string, b: string) => {
      if (a === "bak/a.csv") throw new Error("EIO restore a.csv");
      return innerRename(a, b);
    };
    const r = await executeSwap(entries, results, { ...ctx, fs });
    expect(r.rolledBack).toBe(false);
    expect(r.unrecovered).toContain("a.csv");
    expect(files.has("bak/a.csv")).toBe(true); // la unica copia sobrevive en el backup
    expect(files.has("out/b.json")).toBe(true); // lo restaurable se restauro igual
  });
  it("restore overwrites a placed file (rename semantics) without false alarms", async () => {
    // a.csv se coloca (fase B) y LUEGO falla b.json: el restore de a.csv debe sobreescribir
    // el staged colocado y NO marcarse unrecovered por el doble estado placed+backed.
    const files = new Set(["out/a.csv", "out/b.json", "stg/a.csv", "stg/b.json", "stg/c.png"]);
    const fs = memFs(files, "stg/b.json");
    const r = await executeSwap(entries, results, { ...ctx, fs });
    expect(r).toMatchObject({ rolledBack: true });
    expect(r.unrecovered).toBeUndefined();
    expect(files.has("out/a.csv")).toBe(true);
  });
  it("failed-optional entries are skipped, their old fallback survives", async () => {
    const files = new Set(["out/a.csv", "out/c.png", "stg/a.csv"]);
    const partial = new Map<string, true | string>([["a.csv", true], ["c.png", "HTTP 404"]]);
    const fs = memFs(files);
    const r = await executeSwap(entries, partial, { ...ctx, fs });
    expect(r).toMatchObject({ swapped: 1, rolledBack: false });
    expect(files.has("out/c.png")).toBe(true);
  });
});

describe("swapDisposition — the abort decision the script executes with exit(1)", () => {
  it("unrecovered ⇒ abort, even if rolledBack lied", () => {
    const d = swapDisposition({ swapped: 0, rolledBack: false, unrecovered: ["a.csv"], error: "EIO" });
    expect(d.kind).toBe("abort");
    expect(d).toHaveProperty("message", expect.stringContaining("a.csv"));
  });
  it("clean rollback ⇒ stale with the rollback reason", () => {
    const d = swapDisposition({ swapped: 0, rolledBack: true, error: "EIO b.json" });
    expect(d).toEqual({ kind: "stale", reason: "swap rollback: EIO b.json" });
  });
  it("success ⇒ fresh", () => {
    expect(swapDisposition({ swapped: 96, rolledBack: false })).toEqual({ kind: "fresh" });
  });
});
