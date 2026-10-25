import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DELIVERABLES } from "@/lib/plan-data";
import manifest from "../public/entregables/2026-10-25/manifest.json";
import historical from "../public/entregables/2026-10-24/manifest.json";

describe("cumulative academic catalog", () => {
  it("offers exactly the reviewed activities without claiming submission or Git storage of the derived PDFs", () => {
    expect(manifest.status).toBe("prepared-not-submitted");
    expect(manifest.source_commit).toBe("b5eb855d8a2f582f144fb8194b22d6ade93c2e46");
    expect(manifest.derivation.kind).toBe("local-cumulative-package");
    expect(manifest.derivation.cumulative_pdfs_tracked_in_source_repo).toBe(false);
    expect(manifest.derivation.review_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.artifacts.map((item) => item.id)).toEqual(["A11", "A12", "A13", "A14", "B1", "B2", "B3"]);
    expect(PLAN_DELIVERABLES.filter((item) => item.pdf).map((item) => item.pdf))
      .toEqual(manifest.artifacts.map((item) => item.path));
    expect(manifest.artifacts.some((item) => /ProyectoI|Anteproyecto|C1/.test(item.path))).toBe(false);
  });

  it("binds the active URLs to the exact reviewed PDF bytes and accredited page counts", () => {
    const pages = { A11: 96, A12: 97, A13: 99, A14: 102, B1: 105, B2: 135, B3: 22 };
    for (const artifact of manifest.artifacts) {
      expect(artifact.path).toBe(`/entregables/2026-10-25/${artifact.id}.pdf`);
      const bytes = readFileSync(`public${artifact.path}`);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      expect(artifact.pages).toBe(pages[artifact.id as keyof typeof pages]);
    }
  });

  it("preserves historical PDF bytes and reuses the reviewed B3 presentation unchanged", () => {
    for (const artifact of historical.artifacts) {
      const bytes = readFileSync(`public${artifact.path}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
    }
    expect(manifest.artifacts.find((item) => item.id === "B3")?.sha256)
      .toBe(historical.artifacts.find((item) => item.id === "B3")?.sha256);
  });
});
