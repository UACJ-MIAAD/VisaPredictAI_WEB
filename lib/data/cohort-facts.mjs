/**
 * E5 · Lectura TOLERANTE A LA AUSENCIA de las cifras de cohortes del corte.
 *
 * El artefacto viaja como `required`, no como `critical`: un corte puede no traerlo, y hoy el
 * corte publicado no lo trae. La regla es simple y no se negocia: **si no está sellado, no se
 * muestra nada**. Ni una cifra por defecto, ni una cohorte inventada, ni un «0» que parezca
 * medido. Lo que está presente pero mal formado **lanza**, porque servir un número que no se
 * puede validar es peor que no servir ninguno.
 */

/** Campos que el sitio y el RAG pueden citar. Cada uno con su tipo esperado. */
export const COHORT_FACT_FIELDS = [
  ["NSeriesEvaluable", "int"],
  ["NEstable", "int"],
  ["NNoEstable", "int"],
  ["RuleVersion", "string"],
  ["ScanBate", "int"],
  ["CampanaBate", "int"],
  ["RouterCeldas", "int"],
  ["RouterGana", "int"],
];

const esEntero = (v) => Number.isInteger(v) && v >= 0;

/**
 * Devuelve las cifras de cohortes del corte, o `null` cuando el corte no las trae.
 * @param {unknown} raw contenido de `e5_facts.json`, o `null`/`undefined` si no viaja.
 */
export function readCohortFacts(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("e5_facts.json presente pero no es un objeto");
  }
  const out = {};
  for (const [campo, tipo] of COHORT_FACT_FIELDS) {
    const v = raw[campo];
    if (v === undefined) throw new TypeError(`e5_facts.json sin el campo ${campo}`);
    if (tipo === "int" && !esEntero(v)) {
      throw new TypeError(`e5_facts.json ${campo} no es un entero no negativo: ${JSON.stringify(v)}`);
    }
    if (tipo === "string" && (typeof v !== "string" || !v.trim())) {
      throw new TypeError(`e5_facts.json ${campo} no es una cadena no vacía`);
    }
    out[campo] = v;
  }
  if (out.NEstable + out.NNoEstable !== out.NSeriesEvaluable) {
    throw new TypeError("e5_facts.json incoherente: las cohortes no suman las series evaluables");
  }
  return out;
}

/**
 * Frase de una línea para el corpus del asistente, o `null` si el corte no trae cifras.
 * El resultado negativo viaja con ellas: citar la partición sin decir que nadie ganó sería
 * contar la mitad.
 */
export function cohortSentence(facts, lang = "es") {
  if (!facts) return null;
  const { NSeriesEvaluable: n, NEstable: e, NNoEstable: i, RouterCeldas: c, RouterGana: g } = facts;
  return lang === "en"
    ? `Of ${n} evaluable series, ${e} are stable and ${i} are not, under a rule frozen before` +
      ` looking at any result; of ${c} routing cells, ${g} beat their own cohort's naive-1.`
    : `De ${n} series evaluables, ${e} son estables y ${i} no lo son, bajo una regla congelada` +
      ` antes de mirar ningún resultado; de ${c} celdas de enrutado, ${g} baten al naïve-1 de su` +
      ` propia cohorte.`;
}
