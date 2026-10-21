import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MODEL_CARD_PATH, modelCardForCut, sourcePinForCut } from "../lib/release-model-card.mjs";
import { consumedEntries, MANIFEST_PATH, planSwap, requireStatusArtifacts } from "../lib/release.mjs";

const id = "2026-09-c1-fixture";
const card = Buffer.from(`release_id: ${id}\n\nProtocolo f2-causal acreditado.\n`);
const entry = (body: Buffer) => ({ path: MODEL_CARD_PATH, sha256: createHash("sha256").update(body).digest("hex"), size: body.length, criticality: "required" });
const manifest = { release_id: id, git_sha: "a".repeat(12), generated_at: "2026-10-20T15:00:00Z", artifacts: [entry(card)] };
const served = { release_id: id };

describe("C1: the RAG card is an artifact of the served cut", () => {
  it("uses the hash-verified card with its own release identity", () => {
    expect(modelCardForCut(manifest, served, card)).toEqual({ txt: card.toString(), sha256: entry(card).sha256,
      meta: { source_type: "release_artifact", release_id: id, valid_from: "2026-10-20" } });
    expect(sourcePinForCut(manifest, served)).toMatchObject({ git_sha: manifest.git_sha, coherent: true, release_id: id });
  });
  it.each([null, { release_id: "other" }])("refuses a different or unidentified served cut", (bad) => {
    expect(() => modelCardForCut(manifest, bad, card)).toThrow(/incoherente/);
    expect(() => sourcePinForCut(manifest, bad)).toThrow(/incoherente/);
  });
  it("refuses an unpinned commit", () => {
    expect(() => sourcePinForCut({ ...manifest, git_sha: "main" }, served)).toThrow(/commit/);
  });
  it.each([[], [entry(card), entry(card)], [{ ...entry(card), criticality: "optional" }]].map((artifacts) => ({ artifacts })))("requires a single blocking card entry: $artifacts", ({ artifacts }) => {
    expect(() => modelCardForCut({ ...manifest, artifacts }, served, card)).toThrow(/ausente o ambiguo/);
  });
  it("refuses substituted bytes even when their length matches", () => {
    expect(() => modelCardForCut(manifest, served, Buffer.from(card.toString().replace("acreditado", "suplantado")))).toThrow(/mismatch/);
  });
  it.each([`release_id: other\n`, `release_id: ${id}\nrelease_id: ${id}\n`, "no marker\n"])("requires one matching identity inside the hashed card", (txt) => {
    const body = Buffer.from(txt);
    expect(() => modelCardForCut({ ...manifest, artifacts: [entry(body)] }, served, body)).toThrow(/identidad/);
  });
  it("refuses invalid UTF-8 even with a matching hash", () => {
    const body = Buffer.concat([card, Buffer.from([255])]);
    expect(() => modelCardForCut({ ...manifest, artifacts: [entry(body)] }, served, body)).toThrow();
  });
});

describe("C1: metadata and new required records join the same swap", () => {
  const paths = ["reports/governance/ingestion_state.json", MODEL_CARD_PATH, "vp_data/contracts/ingestion_state.json"];
  const complete = { artifacts: paths.map((path) => ({ path, criticality: "required" })) };
  it("requires all three records with no duplicates or optional downgrades", () => {
    expect(() => requireStatusArtifacts(complete)).not.toThrow();
    for (const path of paths) {
      const rest = complete.artifacts.filter((e) => e.path !== path);
      for (const artifacts of [rest, [...complete.artifacts, { path, criticality: "required" }], [...rest, { path, criticality: "optional" }]]) {
        expect(() => requireStatusArtifacts({ artifacts })).toThrow(path);
      }
    }
  });
  it("uses the captured manifest bytes and vetoes a swap when their staging failed", () => {
    const bytes = Buffer.from(JSON.stringify(manifest));
    const entries = consumedEntries(manifest, bytes);
    expect(entries.at(-1)).toMatchObject({ path: MANIFEST_PATH, out: "release_manifest.json", sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length });
    const results = new Map<string, true | string>(entries.map((e: { out: string }): [string, true] => [e.out, true]));
    expect(planSwap(entries, results).swap).toBe(true);
    results.set("release_manifest.json", "unreadable");
    expect(planSwap(entries, results).swap).toBe(false);
  });
});
