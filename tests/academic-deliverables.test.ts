import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DELIVERABLES } from "@/lib/plan-data";
import manifest from "../public/entregables/2026-11-02/manifest.json";
import neutral from "../public/entregables/2026-11-01/manifest.json";
import cumulative from "../public/entregables/2026-10-30/manifest.json";
import previous from "../public/entregables/2026-10-25/manifest.json";
import historical from "../public/entregables/2026-10-24/manifest.json";

describe("cumulative academic catalog", () => {
  it("offers exactly the reviewed activities without claiming submission or Git storage of the derived PDFs", () => {
    expect(manifest.status).toBe("prepared-not-submitted");
    expect(manifest.source_commit).toBe("1cfb4be35f3bddb92b01bfd181f6d01b5054516a");
    expect(manifest.derivation.kind).toBe("local-cumulative-package");
    expect(manifest.derivation.cumulative_pdfs_tracked_in_source_repo).toBe(false);
    expect(manifest.derivation.review_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.artifacts.map((item) => item.id)).toEqual(["A11", "A12", "A13", "A14", "B1", "B2", "B3"]);
    expect(PLAN_DELIVERABLES.filter((item) => item.pdf).map((item) => item.pdf))
      .toEqual(manifest.artifacts.map((item) => item.path));
    expect(manifest.artifacts.some((item) => /ProyectoI|Anteproyecto|C1/.test(item.path))).toBe(false);
  });

  it("binds the active URLs to the exact reviewed PDF bytes and accredited page counts", () => {
    const pages = { A11: 94, A12: 95, A13: 97, A14: 99, B1: 102, B2: 143, B3: 26 };
    for (const artifact of manifest.artifacts) {
      expect(artifact.path).toBe(`/entregables/2026-11-02/${artifact.id}.pdf`);
      const bytes = readFileSync(`public${artifact.path}`);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      expect(artifact.pages).toBe(pages[artifact.id as keyof typeof pages]);
    }
  });

  it("replaces A11–B2 with the float-placement and appendix-review build and keeps B3 byte for byte", () => {
    for (const artifact of manifest.artifacts) {
      const earlier = neutral.artifacts.find((item) => item.id === artifact.id);
      if (artifact.id === "B3") expect(earlier?.sha256).toBe(artifact.sha256);
      else expect(earlier?.sha256).not.toBe(artifact.sha256);
    }
  });

  it("preserves the earlier catalogs byte for byte", () => {
    for (const earlier of [historical, previous, cumulative, neutral]) {
      for (const artifact of earlier.artifacts) {
        const bytes = readFileSync(`public${artifact.path}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
      }
    }
  });
});
