import { verifyEntry } from "./release.mjs";

export const MODEL_CARD_PATH = "reports/governance/MODEL_CARD.md";

export function sourcePinForCut(manifest, served) {
  if (!served?.release_id || manifest?.release_id !== served.release_id) throw new Error("MODEL_CARD: corte incoherente");
  if (!/^[a-f0-9]{12}$/.test(manifest.git_sha ?? "")) throw new Error("MODEL_CARD: commit del corte inválido");
  return { ref: manifest.git_sha, git_sha: manifest.git_sha, release_id: manifest.release_id,
    generated_at: manifest.generated_at, coherent: true };
}

/** Read only the card whose bytes belong to the served cut, never a pre-seal git revision. */
export function modelCardForCut(manifest, served, body) {
  if (!served?.release_id || manifest?.release_id !== served.release_id) throw new Error("MODEL_CARD: corte incoherente");
  const entries = (manifest.artifacts ?? []).filter((e) => e.path === MODEL_CARD_PATH);
  if (entries.length !== 1 || !["critical", "required"].includes(entries[0].criticality)) throw new Error("MODEL_CARD: artefacto requerido ausente o ambiguo");
  const verified = verifyEntry(entries[0], body);
  if (verified !== true) throw new Error(`MODEL_CARD: ${verified}`);
  const txt = new TextDecoder("utf-8", { fatal: true }).decode(body);
  const markers = [...txt.matchAll(/^release_id: (\S+)$/gm)];
  if (markers.length !== 1 || markers[0][1] !== manifest.release_id) throw new Error("MODEL_CARD: identidad distinta del corte");
  return { txt, sha256: entries[0].sha256, meta: { source_type: "release_artifact",
    release_id: manifest.release_id, valid_from: manifest.generated_at?.slice(0, 10) } };
}
