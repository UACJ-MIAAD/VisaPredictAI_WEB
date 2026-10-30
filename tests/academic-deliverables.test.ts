import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DELIVERABLES } from "@/lib/plan-data";
import manifest from "../public/entregables/2026-10-30/manifest.json";
import previous from "../public/entregables/2026-10-25/manifest.json";
import historical from "../public/entregables/2026-10-24/manifest.json";

describe("cumulative academic catalog", () => {
  it("offers exactly the reviewed activities without claiming submission or Git storage of the derived PDFs", () => {
    expect(manifest.status).toBe("prepared-not-submitted");
    expect(manifest.source_commit).toBe("50fde7456438e1f406ec6c6286ff1dfb2e10ba84");
    expect(manifest.derivation.kind).toBe("local-cumulative-package");
    expect(manifest.derivation.cumulative_pdfs_tracked_in_source_repo).toBe(false);
    expect(manifest.derivation.review_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.artifacts.map((item) => item.id)).toEqual(["A11", "A12", "A13", "A14", "B1", "B2", "B3"]);
    expect(PLAN_DELIVERABLES.filter((item) => item.pdf).map((item) => item.pdf))
      .toEqual(manifest.artifacts.map((item) => item.path));
    expect(manifest.artifacts.some((item) => /ProyectoI|Anteproyecto|C1/.test(item.path))).toBe(false);
  });

  it("binds the active URLs to the exact reviewed PDF bytes and accredited page counts", () => {
    const pages = { A11: 90, A12: 91, A13: 94, A14: 96, B1: 99, B2: 142, B3: 23 };
    for (const artifact of manifest.artifacts) {
      expect(artifact.path).toBe(`/entregables/2026-10-30/${artifact.id}.pdf`);
      const bytes = readFileSync(`public${artifact.path}`);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      expect(artifact.pages).toBe(pages[artifact.id as keyof typeof pages]);
    }
  });

  it("preserves the earlier catalogs byte for byte and replaces every active PDF", () => {
    for (const earlier of [historical, previous]) {
      for (const artifact of earlier.artifacts) {
        const bytes = readFileSync(`public${artifact.path}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      }
    }
    for (const artifact of manifest.artifacts) {
      expect(previous.artifacts.find((item) => item.id === artifact.id)?.sha256).not.toBe(artifact.sha256);
    }
  });
});
