// Materialize the 20% golden hold-out as a GENERATED VIEW under evals/golden/holdout/.
//
// The main evals/golden/*.json files are the complete source of truth; hold-out
// membership is the deterministic function isHoldout(id) (sha256 with a fixed
// seed). This script writes the hold-out members into evals/golden/holdout/*.json
// so a human curator can inspect exactly which questions are reserved — but the
// eval loader NEVER reads these files (it recomputes membership), so the view can
// never silently drift from the source. Re-running it is idempotent.
// Run: node scripts/golden-holdout-split.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_FILES, GOLDEN_DIR, HOLDOUT_DIR, loadGoldenSet, isHoldout, HOLDOUT_SEED, composition } from "./golden-set-lib.mjs";

mkdirSync(HOLDOUT_DIR, { recursive: true });

const all = loadGoldenSet("all");
const held = all.filter((c) => isHoldout(c.id));
const dev = all.filter((c) => !isHoldout(c.id));

// Group the held-out members back by their origin file.
const byFile = new Map(CATEGORY_FILES.map((f) => [f, []]));
for (const c of held) {
  const clean = { ...c };
  delete clean._file;
  delete clean._split;
  byFile.get(c._file).push(clean);
}
for (const [file, cases] of byFile) {
  const path = join(HOLDOUT_DIR, file);
  const payload = {
    description: `GENERATED hold-out view (${file}). Do NOT edit or tune retrieval on these — see README.md. Membership = isHoldout(id), seed "${HOLDOUT_SEED}". Regenerate with: node scripts/golden-holdout-split.mjs`,
    seed: HOLDOUT_SEED,
    cases,
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n");
}

const compAll = composition(all);
const compHold = composition(held);
console.log(`Golden set: ${all.length} total → dev ${dev.length} (${Math.round((dev.length / all.length) * 100)}%) · hold-out ${held.length} (${Math.round((held.length / all.length) * 100)}%)`);
console.log("Hold-out por categoría:", JSON.stringify(compHold.byCategory));
console.log("Hold-out por idioma:", JSON.stringify(compHold.byLang));
console.log(`Vista materializada → ${HOLDOUT_DIR}/{${CATEGORY_FILES.join(",")}}`);
void GOLDEN_DIR; void compAll;
