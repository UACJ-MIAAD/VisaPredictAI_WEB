// F7-R4 · El puntero `PLAN_META.dataMain` contra el `main` REMOTO del repositorio de datos.
//
// Una sola consulta (`git ls-remote`), sin clone ni checkout, con URL y ref CONSTANTES y un
// timeout acotado. Falla cerrado: timeout, salida vacía, duplicada, mal formada, otra ref o un sha
// distinto detienen el job. Se ejecuta en `fetch-integration`, que es donde el web ya contrasta lo
// que sirve contra la fuente gobernada.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DATA_MAIN_REF, DATA_REPO_URL, LS_REMOTE_TIMEOUT_MS, readDeclaredDataMain, verifyAgainstRemote } from "../lib/data-main-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** El ÚNICO acceso a la red de este comando. Argumentos constantes; nada del usuario entra aquí. */
const runner = ({ url, ref, timeoutMs }) =>
  execFileSync("git", ["ls-remote", "--heads", url, ref], {
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });

const declarado = readDeclaredDataMain(readFileSync(resolve(root, "lib/plan-data.ts"), "utf8"));
const problemas = verifyAgainstRemote(runner, declarado);
if (problemas.length > 0) {
  console.error("✗ dataMain no coincide con el main gobernado:");
  for (const p of problemas) console.error(`  - ${p}`);
  console.error(`  (una consulta a ${DATA_REPO_URL} ${DATA_MAIN_REF}, timeout ${LS_REMOTE_TIMEOUT_MS} ms)`);
  process.exit(1);
}
console.log(`✓ dataMain = ${declarado.slice(0, 12)} coincide con ${DATA_MAIN_REF} del repositorio de datos`);
