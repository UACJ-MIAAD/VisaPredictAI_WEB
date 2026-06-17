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
  rhSpanishNote: { es: "", en: "" },

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

  // data explorer
  dataNotFound: { es: "Datos no encontrados.", en: "Data not found." },
};

export function tr(lang: Lang, key: keyof typeof S | string): string {
  const e = S[key as string];
  return e ? e[lang] : (key as string);
}
