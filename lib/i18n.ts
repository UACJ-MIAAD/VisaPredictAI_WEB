import type { Lang } from "@/lib/site-map";

// Chrome / UI strings (the academic body stays in its source language, Spanish).
type Dict = Record<string, { es: string; en: string }>;

const S: Dict = {
  // hero
  heroEyebrow: { es: "Anteproyecto MIAAD · UACJ · Mayo 2026", en: "MIAAD Thesis Proposal · UACJ · May 2026" },
  heroTitlePre: { es: "Predicción de fechas de prioridad en el ", en: "Predicting priority dates in the U.S. " },
  heroTitlePost: { es: " de los Estados Unidos", en: "" },
  heroSub: {
    es: "Sistema predictivo aplicado para el panel multiserie indexado por país o área de cargabilidad × categoría migratoria × tipo de tabla × mes. Pronósticos a horizontes de 1, 3, 6 y 12 meses con intervalos de predicción al 95 %, bajo metodología CRISP-DM y validación walk-forward expansiva — sin privilegiar arquitecturas de antemano.",
    en: "Applied forecasting system for the multi-series panel indexed by country or chargeability area × immigration category × table type × month. Forecasts at 1-, 3-, 6- and 12-month horizons with 95% prediction intervals, under the CRISP-DM methodology and expanding walk-forward validation — with no architecture privileged in advance.",
  },
  heroCtaRead: { es: "Leer el resumen", en: "Read the abstract" },
  heroCtaExplore: { es: "Explorar datos históricos", en: "Explore historical data" },
  statModels: { es: "Modelos comparados", en: "Models compared" },
  statCountries: { es: "Países / áreas piloto", en: "Pilot countries / areas" },
  statObs: { es: "Observaciones del panel", en: "Panel observations" },
  statRefs: { es: "Referencias IEEE", en: "IEEE references" },
  statMethod: { es: "Metodología nominada", en: "Named methodology" },

  // explore
  exploreKicker: { es: "Explorar", en: "Explore" },
  exploreTitle: { es: "El proyecto, en cuatro partes", en: "The project, in four parts" },
  exploreSub: {
    es: "El anteproyecto se divide para leerse con foco: el documento académico, la ingeniería de datos, el explorador histórico interactivo y los recursos de consulta.",
    en: "The proposal is split for focused reading: the academic document, the data engineering, the interactive historical explorer and the reference resources.",
  },

  // route header
  rhBack: { es: "← VisaPredict AI", en: "← VisaPredict AI" },

  // boletines (live feed)
  blnTag: { es: "Datos en vivo · U.S. Visa Bulletin", en: "Live data · U.S. Visa Bulletin" },
  blnTitle: { es: "Boletines", en: "Bulletins" },
  blnSub: {
    es: "Cada mes el Departamento de Estado de EE. UU. publica un nuevo Visa Bulletin. En cuanto aparece, el pipeline lo congela, reconstruye el panel y actualiza este feed automáticamente. Las fechas son datos oficiales publicados —no predicciones del modelo— con el movimiento respecto al mes anterior.",
    en: "Each month the U.S. Department of State publishes a new Visa Bulletin. As soon as it appears, the pipeline freezes it, rebuilds the panel and updates this feed automatically. The dates are official published data —not model predictions— with the movement relative to the previous month.",
  },
  blnBadge: { es: "Nuevo boletín", en: "New bulletin" },
  blnOf: { es: "Boletín de", en: "Bulletin for" },
  blnAdvanced: { es: "categorías avanzaron", en: "categories advanced" },
  blnRetreated: { es: "retrocedieron respecto al mes anterior.", en: "retreated from the previous month." },
  blnSeries: { es: "series", en: "series" },
  blnWindow: { es: "ventana", en: "window" },
  blnMonths: { es: "meses", en: "months" },
  blnUpdated: { es: "actualizado", en: "updated" },
  blnMonth: { es: "Mes del boletín", en: "Bulletin month" },
  blnFilter: { es: "Filtrar", en: "Filter" },
  blnFilterPh: { es: "país, categoría… (ej. México, EB2)", en: "country, category… (e.g. Mexico, EB2)" },
  blnEmpty: { es: "No hay series que coincidan con el filtro.", en: "No series match the filter." },
  blnFiltered: { es: "(filtradas)", en: "(filtered)" },
  blnIn: { es: "en", en: "in" },
  blnError: { es: "No se pudo cargar el feed de boletines en este momento. Intenta recargar la página.", en: "The bulletin feed could not be loaded right now. Try reloading the page." },
  colCountry: { es: "País / área", en: "Country / area" },
  colBlock: { es: "Bloque", en: "Block" },
  colCategory: { es: "Categoría", en: "Category" },
  colTable: { es: "Tabla", en: "Table" },
  colStatus: { es: "Estado", en: "Status" },
  colDate: { es: "Fecha", en: "Date" },
  colMovement: { es: "Movimiento", en: "Movement" },
  blockEmployment: { es: "Empleo", en: "Employment" },
  blockFamily: { es: "Familiar", en: "Family" },

  // historico shell
  histTag: { es: "Datos históricos · panel multiserie", en: "Historical data · multi-series panel" },
  histSub: {
    es: "El corazón empírico del proyecto: el panel real del U.S. Visa Bulletin, desde dic-2001 hasta 2026. Explore la evolución de las fechas de prioridad, compare países bajo el límite del 7 %, observe retrogresiones e inspeccione cada serie disponible. Todas las cifras provienen del CSV publicado; no hay valores inventados.",
    en: "The empirical heart of the project: the real U.S. Visa Bulletin panel, from Dec-2001 through 2026. Explore how priority dates evolve, compare countries under the 7% limit, see retrogressions and inspect every available series. All figures come from the published CSV; no values are fabricated.",
  },
  histError: { es: "Datos no encontrados: no se pudo cargar visa_panel_long.csv.", en: "Data not found: could not load visa_panel_long.csv." },

  // explorer
  selCountry: { es: "País / área de cargabilidad", en: "Country / chargeability area" },
  selCategoryL: { es: "Categoría", en: "Category" },
  selTableL: { es: "Tabla", en: "Table" },
  selStatusL: { es: "Estado", en: "Status" },
  optAll: { es: "todos", en: "all" },
  optAllF: { es: "todas", en: "all" },
  chart1Title: { es: "Evolución de la fecha de prioridad", en: "Priority-date evolution" },
  chart1Desc: { es: "Días desde la fecha base (t₀ = 1975); las caídas son retrogresiones reales.", en: "Days since the base date (t₀ = 1975); drops are real retrogressions." },
  chart1Empty: { es: "Esta combinación no publicó fechas específicas (sólo C/U): sin serie numérica.", en: "This combination never published specific dates (only C/U): no numeric series." },
  chart2Title: { es: "Comparación entre países", en: "Country comparison" },
  chart2Desc: { es: "Disparidad de rezago por el límite del 7 % anual.", en: "Backlog disparity from the 7% annual limit." },
  chart2Empty: { es: "Sin datos para esta categoría/tabla.", en: "No data for this category/table." },
  chart3Title: { es: "Movimiento mes a mes", en: "Month-to-month movement" },
  chart3Desc: { es: "Verde avanza, rojo retrocede.", en: "Green advances, red retreats." },
  chart3Empty: { es: "Sin movimientos calculables para esta serie.", en: "No computable movements for this series." },
  chart4Title: { es: "Distribución de estado administrativo C / F / U", en: "Administrative status distribution C / F / U" },
  chart4Desc: { es: "Calculado sobre las observaciones reales del panel. F (fecha específica) es el único objetivo predictivo.", en: "Computed over the real panel observations. F (specific date) is the only prediction target." },
  tableTitle: { es: "Tabla histórica completa", en: "Full historical table" },
  tableDescA: { es: "observaciones del panel, virtualizadas. Ordene por columna, filtre, ajuste columnas y exporte la vista filtrada a CSV.", en: "panel observations, virtualized. Sort by column, filter, toggle columns and export the filtered view to CSV." },
  tableEmpty: { es: "Sin filas para esta combinación de filtros.", en: "No rows for this filter combination." },
  rows: { es: "filas", en: "rows" },
  columns: { es: "Columnas", en: "Columns" },
  thPais: { es: "País / área", en: "Country / area" },
  thBloque: { es: "Bloque", en: "Block" },
  thCategoria: { es: "Categoría", en: "Category" },
  thTabla: { es: "Tabla", en: "Table" },
  thMes: { es: "Mes", en: "Month" },
  thEstado: { es: "Estado", en: "Status" },
  thFecha: { es: "Fecha prioridad", en: "Priority date" },
  thDias: { es: "Días-base", en: "Days-base" },
  thMov: { es: "Movimiento", en: "Movement" },

  // footer
  footerBlurb: {
    es: "Sitio del proyecto VisaPredict AI · Anteproyecto de la Maestría en Inteligencia Artificial y Analítica de Datos (MIAAD) de la Universidad Autónoma de Ciudad Juárez.",
    en: "VisaPredict AI project site · Thesis proposal for the Master's in Artificial Intelligence and Data Analytics (MIAAD) at the Autonomous University of Ciudad Juárez.",
  },
  footerExternal: { es: "Externos", en: "External" },

  // nav / menu
  menu: { es: "Navegación", en: "Navigation" },
  openMenu: { es: "Abrir menú", en: "Open menu" },
  closeMenu: { es: "Cerrar menú", en: "Close menu" },
  readingProgress: { es: "Progreso de lectura", en: "Reading progress" },
  backToTop: { es: "Volver al inicio", en: "Back to top" },
  toLight: { es: "Activar modo claro", en: "Switch to light mode" },
  toDark: { es: "Activar modo oscuro", en: "Switch to dark mode" },
  toggleTheme: { es: "Cambiar tema", en: "Toggle theme" },
  tableScroll: { es: "Tabla histórica del panel, desplazable", en: "Historical panel table, scrollable" },

  // data explorer
  dataNotFound: { es: "Datos no encontrados.", en: "Data not found." },

  // ── VisaBot
  vbName: { es: "VisaBot", en: "VisaBot" },
  vbOpen: { es: "Abrir el asistente VisaBot", en: "Open the VisaBot assistant" },
  vbClose: { es: "Cerrar el asistente", en: "Close the assistant" },
  vbTagline: {
    es: "Asistente del proyecto · respuestas citadas desde la documentación",
    en: "Project assistant · answers cited from the documentation",
  },
  vbLauncher: { es: "Pregúntale a VisaBot", en: "Ask VisaBot" },
  vbWelcome: {
    es: "Hola 👋 Soy **VisaBot**. Respondo sobre el Visa Bulletin, el panel de datos y la metodología del proyecto, **citando** las fuentes. Prueba una pregunta:",
    en: "Hi 👋 I'm **VisaBot**. I answer about the Visa Bulletin, the data panel and the project's methodology, **citing** the sources. Try a question:",
  },
  vbPlaceholder: { es: "Escribe tu pregunta…", en: "Type your question…" },
  vbSend: { es: "Enviar", en: "Send" },
  vbStop: { es: "Detener", en: "Stop" },
  vbThinking: { es: "Consultando la documentación…", en: "Searching the documentation…" },
  vbNewChat: { es: "Nueva conversación", en: "New chat" },
  vbCopy: { es: "Copiar", en: "Copy" },
  vbCopied: { es: "Copiado", en: "Copied" },
  vbSources: { es: "Fuentes", en: "Sources" },
  vbScrollDown: { es: "Ir al final", en: "Scroll to bottom" },
  vbLoadingEngine: { es: "Cargando el motor semántico…", en: "Loading the semantic engine…" },
  vbEngineReady: { es: "Motor semántico activo", en: "Semantic engine active" },
  vbLexicalOnly: { es: "Búsqueda léxica (el motor semántico sigue cargando)", en: "Lexical search (semantic engine still loading)" },
  vbError: {
    es: "Algo falló al responder. Intenta de nuevo.",
    en: "Something went wrong. Please try again.",
  },
  vbNoIndex: {
    es: "La base de conocimiento aún no está disponible. Vuelve a intentar en un momento.",
    en: "The knowledge base isn't available yet. Please try again shortly.",
  },
  vbExtractiveNote: {
    es: "Respuesta compuesta directamente desde las fuentes (sin el modelo generativo).",
    en: "Answer composed directly from the sources (without the generative model).",
  },
  vbMic: { es: "Dictar por voz", en: "Dictate by voice" },
  vbMicStop: { es: "Detener dictado", en: "Stop dictation" },
  vbSpeak: { es: "Leer en voz alta", en: "Read aloud" },
  vbDisclaimer: {
    es: "VisaBot describe el proyecto; no es asesoría legal migratoria.",
    en: "VisaBot describes the project; it is not immigration legal advice.",
  },

  // ── Assistant console (dedicated /asistente section)
  acTag: { es: "Asistente del proyecto · RAG", en: "Project assistant · RAG" },
  acTitle: { es: "Conversa con VisaBot", en: "Chat with VisaBot" },
  acLead: {
    es: "Un asistente con recuperación aumentada (RAG) de verdad sobre toda la documentación del proyecto: glosario, referencias, diccionario de datos, esquema, metodología y el boletín en vivo. Cada respuesta se genera con un modelo de lenguaje y **cita** sus fuentes, que enlazan a la sección exacta.",
    en: "A real retrieval-augmented (RAG) assistant over the whole project documentation: glossary, references, data dictionary, schema, methodology and the live bulletin. Every answer is generated by a language model and **cites** its sources, which deep-link to the exact section.",
  },
  acTry: { es: "Prueba con:", en: "Try asking:" },
  acStartHint: {
    es: "Escribe una pregunta o elige una sugerencia para empezar.",
    en: "Type a question or pick a suggestion to start.",
  },
  acStatChunks: { es: "Fragmentos indexados", en: "Indexed chunks" },
  acStatSources: { es: "Fuentes distintas", en: "Distinct sources" },
  acStatLangs: { es: "Idiomas", en: "Languages" },
  acStatLatest: { es: "Último boletín", en: "Latest bulletin" },
  acStatRetrieval: { es: "Recuperación", en: "Retrieval" },
  acStatRetrievalVal: { es: "Híbrida (densa + BM25)", en: "Hybrid (dense + BM25)" },
  acHowTag: { es: "Bajo el capó", en: "Under the hood" },
  acHowTitle: { es: "Cómo funciona", en: "How it works" },
  acHowLead: {
    es: "RAG canónico: recuperación híbrida en el navegador y generación citada en el borde.",
    en: "Canonical RAG: hybrid retrieval in the browser and cited generation at the edge.",
  },
  acStep1T: { es: "1 · Base de conocimiento", en: "1 · Knowledge base" },
  acStep1B: {
    es: "En cada despliegue se reconstruye el índice desde el repositorio de datos y el contenido académico —sin hechos escritos a mano— troceando glosario y referencias de forma atómica y embebiendo cada fragmento con un modelo multilingüe local.",
    en: "On every deploy the index is rebuilt from the data repository and the academic content —no hand-written facts— chunking glossary and references atomically and embedding each chunk with a local multilingual model.",
  },
  acStep2T: { es: "2 · Recuperación híbrida", en: "2 · Hybrid retrieval" },
  acStep2B: {
    es: "Tu pregunta se embebe en el navegador y se buscan los fragmentos más relevantes combinando similitud densa (coseno) y léxica (BM25), fusionadas con RRF y diversificadas con MMR.",
    en: "Your question is embedded in the browser and the most relevant chunks are found by combining dense (cosine) and lexical (BM25) similarity, fused with RRF and diversified with MMR.",
  },
  acStep3T: { es: "3 · Generación citada", en: "3 · Cited generation" },
  acStep3B: {
    es: "Los fragmentos recuperados se envían a un modelo Claude que responde únicamente con base en ellos y cita cada afirmación. Si no hay clave o conexión, se compone una respuesta extractiva citada.",
    en: "The retrieved chunks are sent to a Claude model that answers only from them and cites each claim. Without a key or connection, a cited extractive answer is composed.",
  },
  acStep4T: { es: "4 · Trazabilidad", en: "4 · Traceability" },
  acStep4B: {
    es: "Cada cita [n] es un enlace profundo a la sección de origen del sitio, para que puedas verificar la respuesta en la fuente.",
    en: "Each [n] citation is a deep link to its source section on the site, so you can verify the answer against the source.",
  },

  // ── console command center
  acPanorama: { es: "Panorama en vivo", en: "Live panorama" },
  acContext: { es: "Contexto", en: "Context" },
  acTools: { es: "Herramientas", en: "Tools" },
  acQuick: { es: "Consultas rápidas", en: "Quick queries" },
  acConversation: { es: "Conversación", en: "Conversation" },
  acSelCountry: { es: "País / área", en: "Country / area" },
  acSelCategory: { es: "Categoría", en: "Category" },
  acSelTable: { es: "Tabla", en: "Table" },
  acLoadingData: { es: "Cargando el panel de datos…", en: "Loading the data panel…" },
  acDataError: { es: "No se pudo cargar el panel de datos.", en: "Could not load the data panel." },
  acNoData: { es: "No hay datos suficientes para esa combinación.", en: "Not enough data for that combination." },
  toolForecast: { es: "Pronóstico (zoom)", en: "Forecast (zoom)" },
  acHereForecast: { es: "Pronóstico de la fecha de prioridad para tu selección (proyección ilustrativa con bandas al 80 % / 95 %):", en: "Priority-date forecast for your selection (illustrative projection with 80 % / 95 % bands):" },
  toolEvol: { es: "Evolución de fechas", en: "Date evolution" },
  toolCompare: { es: "Comparar países", en: "Compare countries" },
  toolMove: { es: "Movimiento mensual", en: "Monthly movement" },
  toolStatus: { es: "Mezcla C/F/U", en: "C/F/U mix" },
  acHereEvol: { es: "Evolución de la fecha de prioridad para tu selección:", en: "Priority-date evolution for your selection:" },
  acHereCompare: { es: "Comparación de espera entre países o áreas:", en: "Wait-time comparison across countries / areas:" },
  acHereMove: { es: "Movimiento mes a mes (avances y retrocesos):", en: "Month-to-month movement (advances and retrogressions):" },
  acHereStatus: { es: "Cómo se reparten las observaciones por régimen:", en: "How observations split across regimes:" },
  toolRace: { es: "Carrera de países", en: "Country race" },
  toolHeat: { es: "Mapa de calor", en: "Heatmap" },
  toolRadar: { es: "Radar de espera", en: "Wait radar" },
  acHereRace: { es: "Carrera de fechas de prioridad entre países:", en: "Priority-date race across countries:" },
  acHereHeat: { es: "Mapa de calor de la espera por país y categoría:", en: "Heatmap of wait by country and category:" },
  acHereRadar: { es: "Huella de espera de cada país por categoría:", en: "Each country's wait fingerprint by category:" },
  toolTable: { es: "Tabla del mes", en: "Month table" },
  acViewTable: { es: "Ver tabla de este mes", en: "View this month's table" },
  acTableSwipe: { es: "Desliza horizontalmente para ver todos los países", en: "Swipe horizontally to see all countries" },
  acHereTable: { es: "Tabla del Visa Bulletin para el mes seleccionado:", en: "Visa Bulletin table for the selected month:" },
  acSelMonth: { es: "Mes", en: "Month" },
  acPanelToggle: { es: "Panel", en: "Panel" },
  acExamples: { es: "Ejemplos", en: "Examples" },
  acExamplesTitle: { es: "¿Qué puedes preguntar?", en: "What can you ask?" },
  acExamplesLead: {
    es: "Una selección al azar por categoría — vuelve a abrir para ver otras. Toca una para enviarla; las de “Gráficos” y “Pronósticos” generan visualizaciones de datos reales.",
    en: "A random pick per category — reopen for more. Tap one to send it; “Charts” and “Forecasts” ones generate real-data visualizations.",
  },
};

export function tr(lang: Lang, key: keyof typeof S | string): string {
  const e = S[key as string];
  if (!e && process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] missing key: ${String(key)}`);
  }
  return e ? e[lang] : (key as string);
}
