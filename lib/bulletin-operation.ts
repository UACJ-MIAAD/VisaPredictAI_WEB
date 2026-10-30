/** Contrato operativo adoptado por el autor; no es un contador de meses ficticios. */
export const BULLETIN_OPERATION = {
  mode: "manual-automated",
  decisionDate: "2026-10-24",
  inbox: "data/inbox/",
  prerequisite: {
    es: "Preparación inicial: disponer del intérprete y Poppler indicados en el runbook y restaurar la caché histórica desde el archivo autorizado. Un PDF aislado no reconstruye los meses anteriores; si falta procedencia, la preparación se detiene sin inventarla. Con varios PDF en la carpeta, indica FILE con la ruta elegida; los originales no se borran.",
    en: "Initial setup: use the interpreter and Poppler specified in the runbook and restore the historical cache from the authorized archive. One PDF cannot reconstruct previous months; missing provenance stops preparation rather than being invented. If the folder contains multiple PDFs, supply the chosen path in FILE; originals are not deleted.",
  },
  prepareCommand: "make bulletin MONTH=YYYY-MM",
  publishCommand: "make bulletin MONTH=YYYY-MM PUBLISH=1 RECEIPT='ruta/receipt.json'",
  sourceCommit: "9bf7267ffe321d3996e708cb05f391dbe9430e06",
  superseded: {
    browserAdapter: "replaced-by-assisted-pdf-intake",
    twoAutomaticCycles: "replaced-by-per-run-review",
    creditedAutomaticCycles: 0,
  },
  steps: [
    {
      title: { es: "La persona obtiene el PDF", en: "A person obtains the PDF" },
      detail: {
        es: "Descarga el boletín oficial, comprueba el mes y lo deja en data/inbox. La fuente sigue bajo control humano; no se promete evadir su bloqueo web.",
        en: "Download the official bulletin, check its month and place it in data/inbox. A person controls the source; bypassing the website block is not promised.",
      },
    },
    {
      title: { es: "Make prepara un candidato", en: "Make prepares a candidate" },
      detail: {
        es: "Extrae texto y matrices, valida identidades y estados, y construye un candidato de panel y DuckDB con su recibo. Una extracción ambigua se rechaza. Preparar no sube datos ni publica.",
        en: "Extract text and tables, validate identities and statuses, and build a panel and DuckDB candidate with its receipt. Ambiguous extraction is rejected. Preparation neither uploads data nor publishes.",
      },
    },
    {
      title: { es: "La publicación es explícita", en: "Publication is explicit" },
      detail: {
        es: "Tras revisar el candidato, indica la ruta de su recibo en RECEIPT. PUBLISH=1 activa el archivo sin sobrescritura y el circuito mensual gobernado: pronósticos, scoring, informes, corte y entrega con sus puertas. El resultado y la evidencia se verifican; un fallo conserva su diagnóstico.",
        en: "After reviewing the candidate, supply its receipt path in RECEIPT. PUBLISH=1 enables archival without overwriting and the governed monthly path: forecasts, scoring, reports, release and delivery through their gates. Results and evidence are checked; failures retain their diagnosis.",
      },
    },
  ],
  acceptance: {
    es: "A6 y D7 se cierran por adopción y verificación de la operación asistida. La exigencia anterior de dos ciclos automáticos se sustituyó por decisión del autor; no se declaran dos meses exitosos. Se conserva el fallo de entrega de noviembre y su recuperación manual.",
    en: "A6 and D7 close through adoption and verification of assisted operation. The owner replaced the previous two-automatic-cycle requirement; two successful months are not claimed. November's delivery failure and manual recovery are retained.",
  },
} as const;
