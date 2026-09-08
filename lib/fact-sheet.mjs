// F4 · La tarjeta de cifras del VisaBot, DERIVADA de los artefactos gobernados.
//
// Hasta ahora ninguna cifra llegaba al asistente desde un JSON: entraban por prosa
// (content/source.html, la tarjeta del modelo, la auditoría). Por eso una frase vieja podía
// sobrevivir en el corpus mucho después de corregirse en el sitio, como pasó en F2. Aquí las
// cifras se leen de `key_facts.v2` y de `eda_facts`, con etiquetas declaradas y valores nunca
// tecleados: si falta una sección, una clave o el valor no es escalar, la construcción se
// detiene. No hay respaldo a prosa: un dato inventado es peor que un índice que no se genera.

/** Campos de la tarjeta: sección del `v2`, clave, y su etiqueta en cada lengua. */
export const FACT_SHEET_FIELDS = [
  ["data", "n_obs", "Observaciones del panel", "Panel observations"],
  ["data", "n_months", "Meses cubiertos", "Months covered"],
  ["data", "n_series_structural", "Series estructurales", "Structural series"],
  ["data", "n_series_evaluable", "Series evaluables", "Evaluable series"],
  ["data", "n_obs_F", "Observaciones con fecha (estado F)", "Observations with a date (status F)"],
  ["data", "panel_vintage", "Añada del panel", "Panel vintage"],
  ["model", "date_first", "Primer mes", "First month"],
  ["model", "date_last", "Último mes", "Last month"],
  ["model", "naive1_fad_mean", "MASE naïve-1 en FAD (media)", "naive-1 MASE on FAD (mean)"],
  ["model", "ets_fad_mean", "MASE ETS en FAD (media)", "ETS MASE on FAD (mean)"],
  ["eda", "n_retro_events", "Retrogresiones registradas", "Recorded retrogressions"],
  ["eda", "pct_frozen", "Porcentaje de meses congelados", "Percentage of frozen months"],
  ["backfill", "prosp_mase", "MASE prospectivo del sistema desplegado", "Prospective MASE of the deployed system"],
  ["backfill", "prosp_cov95", "Cobertura prospectiva al 95 %", "Prospective coverage at 95%"],
  ["backfill", "prosp_n_scored", "Pronósticos puntuados", "Forecasts scored"],
  ["governance", "n_models", "Modelos en el marco comparativo", "Models in the comparison framework"],
];

/** Campos del chunk compacto de EDA: ruta punteada dentro de `eda_facts` y su etiqueta. */
export const EDA_SHEET_FIELDS = [
  ["vintage", "Añada del censo", "Census vintage"],
  ["panel.n_series_with_F", "Series con al menos una fecha", "Series with at least one date"],
  ["panel.n_series_evaluable", "Series evaluables", "Evaluable series"],
  ["panel.pct_trainable_F", "Porcentaje entrenable (estado F)", "Trainable percentage (status F)"],
  ["panel.date_first", "Primer mes del censo", "First month of the census"],
  ["panel.n_months", "Meses del censo", "Months in the census"],
];

const LANGS = ["es", "en"];

const escalar = (v) => typeof v === "number" || typeof v === "string" || typeof v === "boolean";

/**
 * Una entrada de `key_facts.v2` no es un escalar suelto: es {value, unit, population, source,
 * vintage}. La tarjeta se queda con el valor Y con la unidad y la población, que es justo lo que
 * evita que el asistente cite un MASE sin decir que está medido solo sobre estado F.
 */
function leerV2(seccion, clave, etiqueta) {
  const entrada = seccion[clave];
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new Error(`fact-sheet: falta ${etiqueta} o no es una entrada v2`);
  }
  if (!("value" in entrada) || !escalar(entrada.value)) {
    throw new Error(`fact-sheet: ${etiqueta}.value ausente o no escalar`);
  }
  const matices = [entrada.unit, entrada.population].filter((x) => typeof x === "string" && x && x !== "conteo");
  return matices.length ? `${entrada.value} (${matices.join("; ")})` : String(entrada.value);
}


function leer(raiz, ruta, etiqueta) {
  let nodo = raiz;
  for (const parte of ruta.split(".")) {
    if (nodo === null || typeof nodo !== "object" || Array.isArray(nodo) || !(parte in nodo)) {
      throw new Error(`fact-sheet: falta ${etiqueta} (${ruta}) en el artefacto gobernado`);
    }
    nodo = nodo[parte];
  }
  if (!escalar(nodo)) {
    throw new Error(`fact-sheet: ${ruta} debería ser un escalar, llegó ${Array.isArray(nodo) ? "una lista" : typeof nodo}`);
  }
  return nodo;
}

/**
 * Tarjeta ES/EN + chunk de EDA, en orden fijo y sin valores tecleados. Determinista: la misma
 * entrada produce el mismo texto, byte a byte.
 */
export function collectFactSheet(keyFacts, edaFacts) {
  if (!keyFacts || typeof keyFacts !== "object" || !keyFacts.v2 || typeof keyFacts.v2 !== "object") {
    throw new Error("fact-sheet: key_facts sin bloque `v2` — no hay autoridad de la que derivar");
  }
  if (!edaFacts || typeof edaFacts !== "object") {
    throw new Error("fact-sheet: eda_facts ausente o ilegible");
  }
  const chunks = [];
  for (const lang of LANGS) {
    const idx = lang === "es" ? 2 : 3;
    const lineas = FACT_SHEET_FIELDS.map(([sec, clave, ...labels]) => {
      const seccion = keyFacts.v2[sec];
      if (!seccion || typeof seccion !== "object") {
        throw new Error(`fact-sheet: key_facts.v2.${sec} ausente o no es un objeto`);
      }
      return `${labels[idx - 2]}: ${leerV2(seccion, clave, `key_facts.v2.${sec}.${clave}`)}`;
    });
    chunks.push({
      id: `fact-sheet-${lang}`,
      lang,
      title: lang === "es" ? "Cifras canónicas del sistema" : "Canonical figures of the system",
      text:
        (lang === "es"
          ? "Cifras vigentes, derivadas del corte publicado. No se editan a mano.\n"
          : "Current figures, derived from the published cut. They are never hand-edited.\n") + lineas.join("\n"),
    });
  }
  const edaLineas = LANGS.map((lang) => {
    const i = lang === "es" ? 1 : 2;
    return {
      lang,
      lineas: EDA_SHEET_FIELDS.map(([ruta, ...labels]) => `${labels[i - 1]}: ${leer(edaFacts, ruta, `eda_facts.${ruta}`)}`),
    };
  });
  for (const { lang, lineas } of edaLineas) {
    chunks.push({
      id: `eda-sheet-${lang}`,
      lang,
      title: lang === "es" ? "Radiografía del panel (EDA)" : "Panel snapshot (EDA)",
      text: lineas.join("\n"),
    });
  }
  return chunks;
}

/**
 * El pin del índice contra el corte SERVIDO. Con producción en `fresh` la incoherencia es un
 * fallo: el asistente citaría documentos de un corte y cifras de otro. Los demás estados
 * (ausente, stale, inválido) siguen su contrato explícito y NO se presentan como frescos.
 */
export function assertPinCoherent(pin) {
  const estado = pin?.served_release_status ?? null;
  if (estado === "fresh") {
    if (!pin.coherent) {
      throw new Error(
        `fact-sheet: el corte servido es fresh (${pin.served_release_id ?? "n/d"}) pero los documentos ` +
          `están pinneados a ${pin.release_id ?? "n/d"} — índice incoherente`,
      );
    }
    return "fresh";
  }
  if (estado === null || estado === "n/d") return "absent";
  if (["stale", "legacy", "incompatible"].includes(estado)) return estado;
  throw new Error(`fact-sheet: estado del corte servido desconocido: ${JSON.stringify(estado)}`);
}
