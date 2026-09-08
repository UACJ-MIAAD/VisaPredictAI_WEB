// F7-R3 · `PLAN_META.dataMain` debe ser el corte de datos VIGENTE, y comprobarse contra el
// repositorio de datos de verdad.
//
// Se quedó congelado tres squashes seguidos porque los reemplazos que lo movían no coincidían y
// `str.replace` no falla al no encontrar nada; la prueba que lo fijaba afirmaba el mismo valor
// rancio, así que la suite estaba verde sobre una mentira consistente. Nada relacionaba el puntero
// con el repositorio real: eso es lo que se cierra aquí.
//
// La verificación es **exacta** (igualdad con `origin/main`) y no se apoya en «la última historia»:
// además exige que la evidencia de las historias declaradas resuelva en ese repositorio y sea
// **ancestro o igual** al main declarado. No descarga nada: opera sobre un checkout ya presente.

const HEX40 = /^[0-9a-f]{40}$/;
/** URL y ref CONSTANTES: no entra nada del usuario en el comando. */
export const DATA_REPO_URL = "https://github.com/UACJ-MIAAD/VisaPredictAI.git";
export const DATA_MAIN_REF = "refs/heads/main";
/** Cota del único intento de red. */
export const LS_REMOTE_TIMEOUT_MS = 20_000;
const HEX7 = /^[0-9a-f]{7,40}$/;

/**
 * @param {(args: string[]) => string|null} git  ejecutor de git de SOLO LECTURA sobre el checkout
 *   de datos; devuelve la salida recortada o `null` si el comando falla.
 * @param {string} dataMain  el `PLAN_META.dataMain` declarado por el web.
 * @param {Array<{id: string, evidence?: string}>} stories  historias con evidencia a verificar.
 */
export function verifyDataMain(git, dataMain, stories = []) {
  const problems = [];
  if (typeof dataMain !== "string" || !HEX40.test(dataMain)) {
    problems.push(`dataMain: se esperaba un sha completo de 40 hex, llegó ${JSON.stringify(dataMain)}`);
    return problems;
  }
  const real = git(["rev-parse", "origin/main"]);
  if (real === null) {
    problems.push("no se pudo leer origin/main del repositorio de datos — sin él no se verifica el puntero");
    return problems;
  }
  if (real !== dataMain) {
    problems.push(`dataMain rancio: el web declara ${dataMain.slice(0, 12)} y origin/main es ${real.slice(0, 12)}`);
  }
  for (const story of stories) {
    const sha = String(story.evidence ?? "").split(" ")[0];
    if (!sha || !HEX7.test(sha)) continue; // sin evidencia de commit no hay nada que resolver
    const resuelto = git(["rev-parse", "--verify", `${sha}^{commit}`]);
    if (resuelto === null) {
      problems.push(`${story.id}: la evidencia ${sha} no resuelve en el repositorio de datos`);
      continue;
    }
    if (resuelto !== dataMain && git(["merge-base", "--is-ancestor", resuelto, dataMain]) === null) {
      problems.push(`${story.id}: la evidencia ${sha} no es ancestro ni igual al main declarado`);
    }
  }
  return problems;
}


/**
 * Lee el sha de `main` de una salida de `git ls-remote --heads <url> refs/heads/main`.
 * Exige **exactamente una línea**, sha de 40 hex y **la ref exacta**. Cualquier otra cosa —vacío,
 * duplicado, mal formado, otra ref— es un fallo: el puntero se compara contra algo verificado o no
 * se compara.
 */
export function parseLsRemote(salida) {
  if (typeof salida !== "string") throw new Error(`ls-remote: se esperaba texto, llegó ${typeof salida}`);
  const lineas = salida.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lineas.length === 0) throw new Error("ls-remote: salida vacía — el remoto no respondió con la referencia");
  if (lineas.length > 1) throw new Error(`ls-remote: ${lineas.length} líneas; se esperaba exactamente una`);
  const partes = lineas[0].split(/\s+/);
  if (partes.length !== 2) throw new Error(`ls-remote: línea mal formada: ${JSON.stringify(lineas[0])}`);
  const [sha, ref] = partes;
  if (!HEX40.test(sha)) throw new Error(`ls-remote: sha inválido ${JSON.stringify(sha)}`);
  if (ref !== DATA_MAIN_REF) throw new Error(`ls-remote: ref ${JSON.stringify(ref)} != ${DATA_MAIN_REF}`);
  return sha;
}

/**
 * El puntero contra el `main` REMOTO, con una sola consulta y sin clonar. `runner` se inyecta para
 * que las pruebas sean herméticas: ninguna toca la red. La comprobación de ANCESTRÍA de la
 * evidencia vive en `verifyDataMain`, que necesita un checkout; aquí solo se compara el puntero.
 */
export function verifyAgainstRemote(runner, dataMain) {
  if (typeof dataMain !== "string" || !HEX40.test(dataMain)) {
    return [`dataMain: se esperaba un sha completo de 40 hex, llegó ${JSON.stringify(dataMain)}`];
  }
  let salida;
  try {
    salida = runner({ url: DATA_REPO_URL, ref: DATA_MAIN_REF, timeoutMs: LS_REMOTE_TIMEOUT_MS });
  } catch (e) {
    return [`ls-remote falló (${e.message}) — sin respuesta verificada no se valida el puntero`];
  }
  let real;
  try {
    real = parseLsRemote(salida);
  } catch (e) {
    return [e.message];
  }
  if (real !== dataMain) {
    return [`dataMain rancio: el web declara ${dataMain.slice(0, 12)} y ${DATA_MAIN_REF} es ${real.slice(0, 12)}`];
  }
  return [];
}

/** El `dataMain` declarado, extraído del plan. Falla cerrado si falta o está mal formado. */
export function readDeclaredDataMain(texto) {
  const m = /dataMain:\s*"([0-9a-fA-F]*)"/.exec(String(texto));
  if (!m) throw new Error("plan-data: no se encontró `dataMain`");
  if (!HEX40.test(m[1])) throw new Error(`plan-data: dataMain no es un sha de 40 hex: ${JSON.stringify(m[1])}`);
  return m[1];
}
