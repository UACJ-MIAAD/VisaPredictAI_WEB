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
  rhSpanishNote: {
    es: "",
    en: "Note — the scholarly text below is in Spanish, the thesis language. Navigation, data explorer and figures are bilingual.",
  },

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
