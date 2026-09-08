// F6 · El gancho de cohorte: OPCIONAL y sin inventar nada.
//
// El corte publicado no trae cohortes (comprobado: la palabra no aparece en
// `web_forecasts_meta.json`). La dirección del director —partir el panel en series estables y no
// estables y entrenar cada grupo por su lado— llegará como un campo del metadata gobernado, no
// como una taxonomía escrita en el sitio. Este módulo prepara la lectura y NADA más: mientras el
// campo no exista, la interfaz queda exactamente como está.
//
// Fail-closed: un valor mal tipado, vacío o de estructura ambigua LANZA. El consumidor degrada a
// no pintar nada; una insignia inventada sería peor que ninguna.

export const COHORT_MAX_LEN = 32;
const ID_VALIDO = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;

/**
 * Lee la cohorte declarada de una serie. `null` = el corte no la trae (estado de hoy).
 * Acepta dos formas: la cadena suelta y `{ id }`. Cualquier otra cosa lanza.
 */
export function readCohort(seriesMeta) {
  if (seriesMeta === null || seriesMeta === undefined) return null;
  if (typeof seriesMeta !== "object" || Array.isArray(seriesMeta)) {
    throw new Error(`cohort: se esperaba el metadata de una serie, llegó ${Array.isArray(seriesMeta) ? "una lista" : typeof seriesMeta}`);
  }
  if (!("cohort" in seriesMeta)) return null;
  const crudo = seriesMeta.cohort;
  if (crudo === null || crudo === undefined) return null;

  let id;
  if (typeof crudo === "string") {
    id = crudo;
  } else if (typeof crudo === "object" && !Array.isArray(crudo)) {
    const claves = Object.keys(crudo);
    if (!claves.includes("id")) throw new Error("cohort: objeto sin `id` — estructura ambigua");
    if (typeof crudo.id !== "string") throw new Error(`cohort: 'id' debería ser texto, llegó ${typeof crudo.id}`);
    id = crudo.id;
  } else {
    throw new Error(`cohort: se esperaba texto o { id }, llegó ${Array.isArray(crudo) ? "una lista" : typeof crudo}`);
  }

  const limpio = id.trim();
  if (limpio === "") throw new Error("cohort: identificador vacío — el corte declara la cohorte o no la declara");
  if (limpio.length > COHORT_MAX_LEN) throw new Error(`cohort: identificador de ${limpio.length} caracteres (máximo ${COHORT_MAX_LEN})`);
  if (!ID_VALIDO.test(limpio)) throw new Error(`cohort: identificador con forma inesperada: ${JSON.stringify(id)}`);
  return limpio;
}

/**
 * La etiqueta accesible de una cohorte. Es una función pura para poder probar las dos lenguas en
 * una suite sin DOM (el repositorio corre vitest en entorno `node`, sin librerías de render).
 */
export function cohortLabel(cohorte, lang) {
  return `${lang === "en" ? "Cohort" : "Cohorte"}: ${cohorte}`;
}


/** La lectura tolerante que usa la interfaz: `null` tanto si falta como si viene mal. */
export function cohortOrNull(seriesMeta) {
  try {
    return readCohort(seriesMeta);
  } catch {
    // Fail-closed en la interfaz: no se pinta nada y no se inventa una cohorte.
    return null;
  }
}
