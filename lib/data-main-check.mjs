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
