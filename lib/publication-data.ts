// Plan de publicación en revista indexada (requisito de titulación MIAAD, 4.º semestre).
// Fuente de verdad: Prompts/lote_REVISTA_INDEXADA_2026-11-20/ (informe de 27 revistas del autor,
// verificación web del 20-nov-2026, actas de la mesa redonda R1/R2 y prototipo de primer paso en
// REVISTA2027/analysis/out/). Las cifras del prototipo son PRELIMINARES: no son canónicas ni pasan
// por key_facts hasta que el estimador se integre al pipeline y se selle en un corte.

export type Lang = "es" | "en";
export type Copy = { es: string; en: string };
export const c = (es: string, en: string): Copy => ({ es, en });
export const t = (copy: Copy, lang: Lang) => copy[lang];

export type TaskStatus = "done" | "active" | "planned" | "blocked";

export const PUB_META = {
  updated: "2026-11-20",
  submitBy: "2027-01-31",
  acceptanceTarget: "2027-05-31",
  manuscriptTitle:
    "When will a priority date become current? Calibrated first-passage forecasts and the predictability horizon of U.S. Visa Bulletin cutoffs",
};

export type Journal = {
  rank: number;
  name: string;
  publisher: string;
  index: Copy;
  cost: Copy;
  speed: Copy;
  when: Copy;
  why: Copy;
  deskRisk: Copy;
  url: string;
};

// Orden de la cascada acordado en la ronda 2 (6 de 6 votos de acuerdo con matices).
// Nunca se envía el mismo manuscrito a dos revistas a la vez.
export const JOURNALS: Journal[] = [
  {
    rank: 1,
    name: "Arabian Journal for Science and Engineering",
    publisher: "Springer · KFUPM",
    index: c("Scopus + WoS SCIE · JCR Q2 Multidisciplinaria", "Scopus + WoS SCIE · JCR Q2 Multidisciplinary"),
    cost: c("$0 por la ruta de suscripción", "$0 via the subscription route"),
    speed: c("~53 % publicado en ≤ 6 meses (Editage, 2022)", "~53 % published within 6 months (Editage, 2022)"),
    when: c("Primera opción si no hay fondos para APC.", "First choice if no APC funding is available."),
    why: c(
      "Precedente directo en UACJ: un compañero cumplió el requisito con un manuscrito sometido aquí (sep-2026), también un comparativo donde el modelo simple gana al profundo.",
      "Direct UACJ precedent: a classmate met the requirement with a manuscript submitted here (Sep 2026), also a comparison where the simple model beats deep learning.",
    ),
    deskRisk: c(
      "«Fuera de alcance»: someter a Computer Engineering & Computer Science, abrir con el método (primer paso bajo censura) y usar el boletín como banco de pruebas.",
      "“Out of scope”: submit to Computer Engineering & Computer Science, lead with the method (first passage under censoring) and frame the bulletin as a testbed.",
    ),
    url: "https://link.springer.com/journal/13369",
  },
  {
    rank: 2,
    name: "Forecasting",
    publisher: "MDPI",
    index: c("Scopus + WoS ESCI · JCR Q1 · IF 4.2", "Scopus + WoS ESCI · JCR Q1 · IF 4.2"),
    cost: c("APC CHF 1,800 + impuestos", "APC CHF 1,800 + taxes"),
    speed: c("~24 días a primera decisión (mediana)", "~24 days to first decision (median)"),
    when: c("Primera opción si hay APC y el programa acepta MDPI.", "First choice if APC is funded and the programme accepts MDPI."),
    why: c(
      "Encaje temático exacto y la revista más rápida verificada: el primer paso probabilístico con backtest censurado es pronóstico puro.",
      "Exact topical fit and the fastest verified journal: probabilistic first passage with a censored backtest is pure forecasting.",
    ),
    deskRisk: c(
      "«Estudio de caso sin aporte generalizable»: declarar tres aportes (protocolo sin sesgo de censura, horizonte de predictibilidad frente a la climatología, panel abierto con DOI).",
      "“Single case study without generalisable contribution”: state three contributions (censoring-free protocol, predictability horizon versus climatology, open panel with DOI).",
    ),
    url: "https://www.mdpi.com/journal/forecasting",
  },
  {
    rank: 3,
    name: "Computación y Sistemas",
    publisher: "IPN · CIC (México)",
    index: c("Scopus + JCR (IF 0.8) · SciELO · SECIHTI SNPCyH 2026", "Scopus + JCR (IF 0.8) · SciELO · SECIHTI SNPCyH 2026"),
    cost: c("$0 · acceso abierto diamante", "$0 · diamond open access"),
    speed: c("Tiempos no publicados: auditar fechas de recepción y aceptación", "No published times: audit received/accepted dates"),
    when: c("Red de seguridad nacional, en español o inglés.", "National safety net, in Spanish or English."),
    why: c(
      "Cumple cualquier definición plausible de «indexada» (Scopus, JCR y el padrón nacional) sin costo, y conoce a la comunidad MICAI.",
      "Meets any plausible definition of “indexed” (Scopus, JCR and the national registry) at no cost, and knows the MICAI community.",
    ),
    deskRisk: c(
      "«Contribución incremental»: no venderlo como comparativo de 24 modelos sino como estimador de espera calibrado.",
      "“Incremental contribution”: do not sell a 24-model comparison; sell a calibrated waiting-time estimator.",
    ),
    url: "https://www.cys.cic.ipn.mx/ojs/index.php/CyS",
  },
];

export const BACKUPS: { name: string; note: Copy }[] = [
  { name: "Applied Intelligence (Springer)", note: c("SCIE Q2 · $0 suscripción", "SCIE Q2 · $0 subscription") },
  { name: "IEEE Access", note: c("SCIE · USD 2,160 · 4–6 semanas", "SCIE · USD 2,160 · 4–6 weeks") },
  { name: "Inteligencia Artificial (IBERAMIA)", note: c("Scopus + ESCI · $0 · JIF 0.9", "Scopus + ESCI · $0 · JIF 0.9") },
  { name: "Migraciones Internacionales (El Colef)", note: c("Scopus + SNPCyH · $0 · sólo con reencuadre migratorio", "Scopus + SNPCyH · $0 · only with a migration framing") },
];

export const RULED_OUT: Copy[] = [
  c("International Journal of Forecasting: ~15 % de aceptación y plazos cercanos a un año.", "International Journal of Forecasting: ~15 % acceptance and close to a year of review."),
  c("Estudios Fronterizos: cerrada a envíos al 20-nov-2026.", "Estudios Fronterizos: closed to submissions as of 20 Nov 2026."),
  c("Research in Computing Science: fuera de Scopus y del padrón SNPCyH.", "Research in Computing Science: outside Scopus and the SNPCyH registry."),
  c("MICAI y COMIA: son congresos (LNCS/CCIS), no revistas.", "MICAI and COMIA: conferences (LNCS/CCIS), not journals."),
];

export type Expert = { name: string; model: string; vote: Copy; correction: Copy };

export const EXPERTS: Expert[] = [
  {
    name: "Opus",
    model: "Claude Opus 5.5",
    vote: c("A–D, F, G de acuerdo · E recortar", "A–D, F, G agree · E trim scope"),
    correction: c(
      "La figura principal es el Brier skill score frente a la climatología por horizonte, con el cruce marcado.",
      "The headline figure is the Brier skill score versus climatology by horizon, with the crossover marked.",
    ),
  },
  {
    name: "Fable",
    model: "Claude Fable 5.2",
    vote: c("De acuerdo salvo «validado a 15 años»", "Agree except “validated to 15 years”"),
    correction: c(
      "Horizonte validado ≤ 5 años; de 5 a 15, habilidad decreciente documentada; conformal rodante y bootstrap por clúster.",
      "Validated horizon ≤ 5 years; 5–15 years documented decaying skill; rolling conformal and cluster bootstrap.",
    ),
  },
  {
    name: "Sol",
    model: "GPT-6.1 Sol",
    vote: c("De acuerdo · objeta B y E", "Agree · objects to B and E"),
    correction: c(
      "Auditar la disponibilidad temporal de las etiquetas: calibrar sólo con desenlaces ya observados en cada origen.",
      "Audit label availability in time: calibrate only with outcomes already observed at each origin.",
    ),
  },
  {
    name: "Hydrogen",
    model: "Gemini 4 Hydrogen",
    vote: c("De acuerdo · objeta E", "Agree · objects to E"),
    correction: c(
      "Calibración ponderada por censura (IPCW) y shrinkage hacia la climatología antes de añadir modelos.",
      "Censoring-weighted calibration (IPCW) and shrinkage toward climatology before adding models.",
    ),
  },
  {
    name: "AGY",
    model: "Gemini 4 Neon",
    vote: c("De acuerdo · objeta B, C y E", "Agree · objects to B, C and E"),
    correction: c(
      "Si basta «sometido», AJSE es la #1 aunque haya APC; horizonte validado de 5 a 8 años y calibración consciente de censura.",
      "If “submitted” suffices, AJSE is #1 even with APC funding; validated horizon of 5 to 8 years and censoring-aware calibration.",
    ),
  },
  {
    name: "Grok",
    model: "Grok 4.7",
    vote: c("De acuerdo · objeta B, C, E y F", "Agree · objects to B, C, E and F"),
    correction: c(
      "Sin APC, Computación y Sistemas antes que AJSE; toda banda de más de 5 años se rotula «escenario no calibrado»; el 31 de enero es tope, no meta.",
      "Without APC, Computación y Sistemas before AJSE; every band beyond 5 years is labelled “uncalibrated scenario”; 31 January is a cap, not a target.",
    ),
  },
];

export type Phase = { id: string; weeks: string; title: Copy; tasks: { id: string; text: Copy; status: TaskStatus; done?: Copy }[] };

export const PHASES: Phase[] = [
  {
    id: "P0",
    weeks: "Sem 0 · 20-nov",
    title: c("Investigación y consenso", "Research and consensus"),
    tasks: [
      { id: "P0.1", text: c("Validar el informe de 27 revistas y ampliarlo (revistas de datos, padrón SNPCyH, AJSE)", "Validate the 27-journal report and extend it (data journals, SNPCyH registry, AJSE)"), status: "done" },
      { id: "P0.2", text: c("Mesa redonda de seis modelos, dos rondas, acta de consenso", "Six-model round table, two rounds, consensus record"), status: "done" },
      { id: "P0.3", text: c("Prototipo de tiempo de primer paso con backtest censurado sobre el panel real", "First-passage prototype with censored backtest on the real panel"), status: "done" },
    ],
  },
  {
    id: "P1",
    weeks: "Sem 1 · 23–29 nov",
    title: c("Gates humanos (bloquean todo lo demás)", "Human gates (block everything else)"),
    tasks: [
      { id: "P1.1", text: c("Correo a la coordinación MIAAD y al Dr. Vicente: índice válido, ¿basta «sometido»?, ¿cuenta MDPI?, ¿hay fondos para APC?", "Email the MIAAD coordination and Dr. Vicente: valid index, is “submitted” enough, does MDPI count, is APC funded?"), status: "blocked" },
      { id: "P1.2", text: c("Transcribir las recomendaciones de los sinodales de la Cumbre y mapearlas a cambios", "Transcribe the Summit examiners' recommendations and map them to changes"), status: "blocked" },
      { id: "P1.3", text: c("Fijar orden de autores y revista #1 con el director", "Agree author order and journal #1 with the advisor"), status: "planned" },
    ],
  },
  {
    id: "P2",
    weeks: "Sem 2–5 · dic",
    title: c("Estimador de primer paso calibrado", "Calibrated first-passage estimator"),
    tasks: [
      { id: "P2.1", text: c("Bootstrap por bloques alineado al año fiscal; meses C y U como estados", "Fiscal-year-aligned block bootstrap; C and U months as states"), status: "active" },
      { id: "P2.2", text: c("Conformal rodante con desenlaces disponibles en cada origen (sin fuga temporal)", "Rolling conformal using only outcomes available at each origin (no temporal leakage)"), status: "planned" },
      { id: "P2.3", text: c("Shrinkage hacia la climatología por horizonte y Brier/IBS ponderado por censura (IPCW)", "Shrinkage toward climatology by horizon and censoring-weighted Brier/IBS (IPCW)"), status: "planned" },
      { id: "P2.4", text: c("Baselines: velocidad determinista, paseo aleatorio con deriva, climatología; IC por bootstrap de clúster", "Baselines: deterministic velocity, random walk with drift, climatology; cluster-bootstrap CIs"), status: "planned" },
      { id: "P2.5", text: c("Go/no-go semana 6: semi-Markov de tres regímenes sólo si mejora fuera de muestra", "Week-6 go/no-go: three-regime semi-Markov only if it improves out of sample"), status: "planned" },
    ],
  },
  {
    id: "P3",
    weeks: "Sem 6–8 · ene",
    title: c("Datos abiertos y figuras", "Open data and figures"),
    tasks: [
      { id: "P3.1", text: c("Panel y código congelados en Zenodo con DOI, diccionario F/C/U y licencia", "Panel and code frozen on Zenodo with DOI, F/C/U dictionary and licence"), status: "planned" },
      { id: "P3.2", text: c("Figura principal: Brier skill score vs climatología por horizonte; fiabilidad por K; curvas de supervivencia por serie", "Headline figure: Brier skill score vs climatology by horizon; reliability by K; survival curves per series"), status: "planned" },
      { id: "P3.3", text: c("Go/no-go semana 8: si la cobertura a 10 años no se recalibra, recortar el claim", "Week-8 go/no-go: if 10-year coverage cannot be recalibrated, trim the claim"), status: "planned" },
    ],
  },
  {
    id: "P4",
    weeks: "Sem 6–9 · ene",
    title: c("Manuscrito", "Manuscript"),
    tasks: [
      { id: "P4.1", text: c("Esqueleto en inglés con abstract, contribuciones y estructura IMRaD", "English skeleton with abstract, contributions and IMRaD structure"), status: "active" },
      { id: "P4.2", text: c("Plantilla de la revista elegida, carta de presentación y revisores sugeridos", "Chosen journal's template, cover letter and suggested reviewers"), status: "planned" },
      { id: "P4.3", text: c("Similitud < 15 % frente a los borradores MICAI y COMIA; congresos congelados", "Similarity < 15 % against the MICAI and COMIA drafts; conferences frozen"), status: "planned" },
      { id: "P4.4", text: c("Revisión del director y reproducción independiente desde el repositorio", "Advisor review and independent reproduction from the repository"), status: "planned" },
    ],
  },
  {
    id: "P5",
    weeks: "≤ 31-ene-2027",
    title: c("Envío", "Submission"),
    tasks: [
      { id: "P5.1", text: c("Someter a la revista #1 y archivar el número de manuscrito", "Submit to journal #1 and file the manuscript number"), status: "planned" },
      { id: "P5.2", text: c("Paquete del respaldo ya formateado para reenviar en ≤ 7 días si hay rechazo", "Backup package pre-formatted to resubmit within 7 days after a rejection"), status: "planned" },
    ],
  },
  {
    id: "P6",
    weeks: "Feb–may 2027",
    title: c("Revisión y aceptación", "Review and acceptance"),
    tasks: [
      { id: "P6.1", text: c("Respuesta punto por punto en ≤ 10 días por ronda", "Point-by-point response within 10 days per round"), status: "planned" },
      { id: "P6.2", text: c("Integrar el estimador al sitio y a VisaBot (sólo tras su sello)", "Integrate the estimator into the site and VisaBot (only once sealed)"), status: "planned" },
      { id: "P6.3", text: c("Carta de aceptación o constancia de envío al expediente de titulación", "Acceptance letter or submission record into the graduation file"), status: "planned" },
    ],
  },
];

// Resultados del prototipo (REVISTA2027/analysis/out/fpt_brier.json, 20-nov-2026).
// Brier de P(current ≤ K) en orígenes con K observable: menor es mejor.
export const FPT_BRIER = [
  { months: 12, n: 3910, fpt: 0.071, velocity: 0.102, climatology: 0.094 },
  { months: 36, n: 3535, fpt: 0.125, velocity: 0.175, climatology: 0.202 },
  { months: 60, n: 2815, fpt: 0.155, velocity: 0.227, climatology: 0.249 },
  { months: 120, n: 1715, fpt: 0.212, velocity: 0.336, climatology: 0.176 },
  { months: 180, n: 790, fpt: 0.268, velocity: 0.384, climatology: 0.086 },
];

export const RISKS: { title: Copy; fix: Copy }[] = [
  {
    title: c("Que la revista o el tipo de artículo no cuenten", "The journal or article type does not count"),
    fix: c("Respuesta escrita de la coordinación en la semana 1, con el precedente AJSE como ejemplo.", "Written answer from the coordination in week 1, with the AJSE precedent as example."),
  },
  {
    title: c("Sobreprometer la fecha a 20–30 años", "Overpromising the 20–30 year date"),
    fix: c("Habilidad demostrada sólo donde se gana a la climatología; más allá, escenario etiquetado y P(> 30 años).", "Skill claimed only where climatology is beaten; beyond that, labelled scenario and P(> 30 years)."),
  },
  {
    title: c("El reloj editorial", "The editorial clock"),
    fix: c("Envío a más tardar el 31-ene-2027, respaldo preformateado y un solo manuscrito en revisión.", "Submission by 31 Jan 2027, pre-formatted backup and only one manuscript under review."),
  },
  {
    title: c("Redundancia con MICAI/COMIA", "Redundancy with MICAI/COMIA"),
    fix: c("Texto nuevo, citas cruzadas y congresos detenidos mientras la revista decide.", "New text, cross-citations and conferences paused while the journal decides."),
  },
];
