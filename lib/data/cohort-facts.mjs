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
  ["RouterPierde", "int"],
  ["RouterSinEvidencia", "int"],
  ["ScanPeor", "int"],
  ["ScanSinDatos", "int"],
  ["CampanaLanes", "int"],
  ["CampanaOk", "int"],
  ["CampanaPrimarias", "int"],
];

/** Tablas del reparto por tabla, en el orden en que se muestran. */
export const COHORT_TABLES = ["FAD", "DFF"];

/**
 * Vocabulario CERRADO del estado de la épica. El artefacto lo escribe en español; la etiqueta
 * inglesa se declara aquí y un estado desconocido lanza en lugar de mostrarse sin traducir.
 */
export const COHORT_STATUS = { exploratorio: { es: "exploratorio", en: "exploratory" } };

const esEntero = (v) => Number.isInteger(v) && v >= 0;

function leerPorTabla(raw) {
  const t = raw.cohorts_by_table;
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    throw new TypeError("e5_facts.json sin el reparto por tabla (cohorts_by_table)");
  }
  const out = {};
  for (const tabla of COHORT_TABLES) {
    const fila = t[tabla];
    if (!fila || !esEntero(fila.estable) || !esEntero(fila.no_estable)) {
      throw new TypeError(`e5_facts.json reparto por tabla ${tabla} ausente o no entero`);
    }
    out[tabla] = { estable: fila.estable, no_estable: fila.no_estable };
  }
  return out;
}

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
  if (out.RouterGana + out.RouterPierde + out.RouterSinEvidencia !== out.RouterCeldas) {
    throw new TypeError("e5_facts.json incoherente: los veredictos del enrutador no suman las celdas");
  }
  if (out.CampanaOk > out.CampanaLanes || out.CampanaBate > out.CampanaPrimarias) {
    throw new TypeError("e5_facts.json incoherente: la campaña declara más éxitos que corridas");
  }
  const byTable = leerPorTabla(raw);
  const suma = (k) => COHORT_TABLES.reduce((s, tabla) => s + byTable[tabla][k], 0);
  if (suma("estable") !== out.NEstable || suma("no_estable") !== out.NNoEstable) {
    throw new TypeError("e5_facts.json incoherente: el reparto por tabla no suma la partición");
  }
  if (!Object.hasOwn(COHORT_STATUS, raw.status)) {
    throw new TypeError(`e5_facts.json estado fuera del vocabulario: ${JSON.stringify(raw.status)}`);
  }
  out.byTable = byTable;
  out.status = raw.status;
  return out;
}

/**
 * La copia de la superficie visible, en una sola lengua y completa. Pura (sin DOM) para que la
 * suite pruebe las dos lenguas; el componente sólo la pinta. `null` si el corte no trae cifras.
 */
export function cohortSurface(facts, lang = "es") {
  if (!facts) return null;
  const en = lang === "en";
  const f = facts;
  const status = COHORT_STATUS[f.status][en ? "en" : "es"];
  return {
    eyebrow: en ? "Stability cohorts" : "Cohortes de estabilidad",
    title: en
      ? "Splitting the panel into stable and unstable series did not beat naive-1"
      : "Partir el panel en series estables y no estables no le ganó al naïve-1",
    intro: en
      ? `Each evaluable series is labeled stable or unstable by rule v${f.RuleVersion}, frozen before looking at any result and computed only with information prior to the hold-out. Each cohort is then compared against its own naive-1 floor.`
      : `Cada serie evaluable se etiqueta como estable o no estable con la regla v${f.RuleVersion}, congelada antes de mirar ningún resultado y calculada solo con información anterior al hold-out. Después, cada cohorte se compara contra su propio piso naïve-1.`,
    stats: [
      { value: String(f.NSeriesEvaluable), label: en ? "evaluable series" : "series evaluables" },
      { value: String(f.NEstable), label: en ? "stable" : "estables" },
      { value: String(f.NNoEstable), label: en ? "unstable" : "no estables" },
      {
        value: `${f.RouterGana} / ${f.RouterCeldas}`,
        label: en ? "routing cells that pass the gate" : "celdas de enrutado que pasan el gate",
      },
    ],
    tableHead: en ? ["Table", "Stable", "Unstable"] : ["Tabla", "Estables", "No estables"],
    byTable: COHORT_TABLES.map((table) => ({
      table,
      stable: f.byTable[table].estable,
      unstable: f.byTable[table].no_estable,
    })),
    findings: en
      ? [
          `Scan of already-scored recipes: ${f.ScanBate} beat their cohort's naive-1; ${f.ScanPeor} do worse and ${f.ScanSinDatos} lack sufficient data.`,
          `Per-cohort CPU campaign: ${f.CampanaOk} of ${f.CampanaLanes} runs completed; ${f.CampanaBate} of ${f.CampanaPrimarias} primary recipes beat that floor.`,
          `Cohort routing: of ${f.RouterCeldas} cells, ${f.RouterGana} pass the gate; ${f.RouterPierde} loses materially and ${f.RouterSinEvidencia} show no conclusive gain.`,
        ]
      : [
          `Barrido de lo ya puntuado: ${f.ScanBate} recetas baten al naïve-1 de su cohorte; ${f.ScanPeor} quedan por debajo y ${f.ScanSinDatos} no tienen datos suficientes.`,
          `Campaña por cohorte (CPU): ${f.CampanaOk} de ${f.CampanaLanes} corridas completadas; ${f.CampanaBate} de ${f.CampanaPrimarias} recetas primarias baten ese piso.`,
          `Enrutado por cohorte: de ${f.RouterCeldas} celdas, ${f.RouterGana} pasan el gate; ${f.RouterPierde} pierde de forma material y ${f.RouterSinEvidencia} no muestran una mejora concluyente.`,
        ],
    statusLabel: en ? "Status" : "Estado",
    status,
    statusNote: en
      ? "The router is neither deployed nor promoted; authorizing it would require a prospective shadow, like any challenger."
      : "El enrutador no está desplegado ni promovido; autorizarlo exigiría sombra prospectiva, igual que cualquier retador.",
  };
}

/**
 * Chunks del asistente, uno por lengua, derivados de la misma copia que la superficie. El título
 * lleva las palabras con que se pregunta («stable», «unstable», «cohorts») porque el ranking
 * léxico previo al consentimiento sólo encuentra el chunk si comparte esos términos.
 */
export function cohortChunks(facts) {
  if (!facts) return [];
  return ["es", "en"].map((lang) => {
    const s = cohortSurface(facts, lang);
    const en = lang === "en";
    const reparto = s.byTable
      .map((r) =>
        en
          ? `${r.table}: ${r.stable} stable and ${r.unstable} unstable`
          : `${r.table}: ${r.stable} estables y ${r.unstable} no estables`,
      )
      .join("; ");
    const text = [
      en
        ? `Of ${facts.NSeriesEvaluable} evaluable series, ${facts.NEstable} are stable and ${facts.NNoEstable} are unstable (rule v${facts.RuleVersion}, frozen before looking at any result).`
        : `De ${facts.NSeriesEvaluable} series evaluables, ${facts.NEstable} son estables y ${facts.NNoEstable} no estables (regla v${facts.RuleVersion}, congelada antes de mirar ningún resultado).`,
      (en ? "By table: " : "Por tabla: ") + reparto + ".",
      ...s.findings,
      `${s.statusLabel}: ${s.status}. ${s.statusNote}`,
    ].join("\n");
    return {
      id: `cohort-facts-${lang}`,
      lang,
      kind: "fact",
      title: en
        ? "Stability cohorts: how many series are stable and unstable"
        : "Cohortes de estabilidad: cuántas series son estables y no estables",
      text,
    };
  });
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
