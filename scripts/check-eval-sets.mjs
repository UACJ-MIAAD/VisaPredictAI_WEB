// G2 (plan auditoría 2026-07-11): validación estructural + versionado de los sets de
// evaluación del VisaBot, en el job de PR (barato, sin modelo ni red). La "versión" de
// cada set es el hash de su contenido — un diff de baseline entre corridas es un cambio
// de set explícito, nunca silencioso. La suite COMPLETA (índice real + gate de
// retrieval por estrato) corre en scheduled-quality.yml.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const problems = [];
const version = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 12);

async function check(name, validate) {
  const path = join(process.cwd(), "scripts", name);
  try {
    const raw = await readFile(path);
    const data = JSON.parse(raw.toString("utf8"));
    const summary = validate(data);
    console.log(`  ✓ ${name} v${version(raw)} — ${summary}`);
  } catch (e) {
    problems.push(`${name}: ${e.message}`);
  }
}

await check("rag-eval-set.json", (d) => {
  if (!Array.isArray(d.cases) || d.cases.length < 20) throw new Error(`cases inválidos o muy pocos (${d.cases?.length})`);
  for (const c of d.cases) {
    if (!c.q && !c.query) throw new Error("caso sin query");
  }
  return `${d.cases.length} casos de retrieval`;
});

await check("rag-injection-set.json", (d) => {
  if (!Array.isArray(d.injections) || d.injections.length < 10) {
    throw new Error(`injections inválidas o muy pocas (${d.injections?.length})`);
  }
  const nSerial = Array.isArray(d.serial) ? d.serial.length : 0;
  return `${d.injections.length} ataques de inyección + ${nSerial} multi-turn`;
});

if (problems.length) {
  console.error(`check-eval-sets: ✗ ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("check-eval-sets: ✓ sets de evaluación válidos y versionados");
