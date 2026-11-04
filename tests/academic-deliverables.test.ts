import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DELIVERABLES } from "@/lib/plan-data";
import manifest from "../public/entregables/2026-11-04/manifest.json";

describe("cumulative academic catalog", () => {
  it("offers exactly the reviewed activities without claiming submission or Git storage of the derived PDFs", () => {
    expect(manifest.status).toBe("prepared-not-submitted");
    expect(manifest.source_commit).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.derivation.kind).toBe("local-cumulative-package");
    expect(manifest.derivation.cumulative_pdfs_tracked_in_source_repo).toBe(false);
    expect(manifest.derivation.review_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.artifacts.map((item) => item.id)).toEqual(["A11", "A12", "A13", "A14", "B1", "B2", "B3"]);
    expect(PLAN_DELIVERABLES.filter((item) => item.pdf).map((item) => item.pdf))
      .toEqual(manifest.artifacts.map((item) => item.path));
    expect(manifest.artifacts.some((item) => /ProyectoI|Anteproyecto|C1/.test(item.path))).toBe(false);
  });

  it("binds the active URLs to the exact reviewed PDF bytes and accredited page counts", () => {
    const pages = { A11: 89, A12: 90, A13: 92, A14: 95, B1: 98, B2: 138, B3: 26 };
    for (const artifact of manifest.artifacts) {
      expect(artifact.path).toBe(`/entregables/2026-11-04/${artifact.id}.pdf`);
      const bytes = readFileSync(`public${artifact.path}`);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      expect(artifact.pages).toBe(pages[artifact.id as keyof typeof pages]);
    }
  });

  it("serves only the current catalog: earlier ones are retired, not left reachable but unlinked", () => {
    expect(readdirSync("public/entregables")).toEqual(["2026-11-04"]);
    expect(readdirSync("public/entregables/2026-11-04").sort())
      .toEqual([...manifest.artifacts.map((item) => `${item.id}.pdf`), "manifest.json"].sort());
  });
});
