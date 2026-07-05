// Single source of truth for the whole site structure (bilingual ES/EN).
// Nav, scroll-spy, mobile menu, footer and page composition derive from here.

export type Lang = "es" | "en";

export type Section = { id: string; label: string; labelEn: string };
export type Route = {
  path: string;
  label: string;
  labelEn: string;
  short: string;
  shortEn: string;
  blurb: string;
  blurbEn: string;
  sections: Section[];
};

export const ROUTES: Route[] = [
  {
    path: "/",
    label: "Inicio",
    labelEn: "Home",
    short: "Inicio",
    shortEn: "Home",
    blurb: "Visión general del proyecto y acceso a cada parte.",
    blurbEn: "Project overview and a way into each part.",
    sections: [
      { id: "inicio", label: "Inicio", labelEn: "Top" },
      { id: "problema", label: "El problema", labelEn: "The problem" },
      { id: "evidencia", label: "Pronóstico y evidencia", labelEn: "Forecast & evidence" },
      { id: "explorar", label: "Explorar", labelEn: "Explore" },
      { id: "resumen", label: "Resumen", labelEn: "Abstract" },
      { id: "autores", label: "Autores", labelEn: "Authors" },
      { id: "contacto", label: "Contacto", labelEn: "Contact" },
    ],
  },
  {
    path: "/anteproyecto",
    label: "Anteproyecto",
    labelEn: "Proposal",
    short: "Anteproyecto",
    shortEn: "Proposal",
    blurb:
      "El documento académico: introducción, marco teórico, producto, metodología CRISP-DM, tablas y reproducibilidad.",
    blurbEn:
      "The academic document: introduction, theoretical framework, product, CRISP-DM methodology, tables and reproducibility.",
    sections: [
      { id: "capi", label: "I · Introducción", labelEn: "I · Introduction" },
      { id: "capii", label: "II · Marco teórico", labelEn: "II · Framework" },
      { id: "capiii", label: "III · Producto y validación", labelEn: "III · Product & validation" },
      { id: "capiv", label: "IV · Metodología CRISP-DM", labelEn: "IV · CRISP-DM methodology" },
      { id: "tablas", label: "Tablas y figuras", labelEn: "Tables & figures" },
      { id: "reproducibilidad", label: "Reproducibilidad", labelEn: "Reproducibility" },
    ],
  },
  {
    path: "/ingenieria",
    label: "Ingeniería de datos",
    labelEn: "Data engineering",
    short: "Ingeniería",
    shortEn: "Engineering",
    blurb:
      "Cómo se construyó y entendió el panel: pipeline, análisis exploratorio, ingeniería de características, prácticas MLOps, estructura del repositorio y almacén en esquema estrella.",
    blurbEn:
      "How the panel was built and understood: pipeline, exploratory analysis, feature engineering, MLOps practices, repository structure and a star-schema warehouse.",
    sections: [
      { id: "datos", label: "Construcción del panel", labelEn: "Building the panel" },
      { id: "eda", label: "Análisis exploratorio", labelEn: "Exploratory analysis" },
      { id: "fe", label: "Ingeniería de características", labelEn: "Feature engineering" },
      { id: "mlops", label: "Prácticas MLOps", labelEn: "MLOps practices" },
      { id: "estructura", label: "Estructura del repo", labelEn: "Repo structure" },
      { id: "modelo", label: "Modelo de datos", labelEn: "Data model" },
    ],
  },
  {
    path: "/datos-historicos",
    label: "Datos históricos",
    labelEn: "Historical data",
    short: "Datos",
    shortEn: "Data",
    blurb:
      "El corazón empírico: boletín en vivo, pronóstico por categoría, explorador interactivo del panel real y el marcador prospectivo del sistema.",
    blurbEn:
      "The empirical heart: a live bulletin, per-category forecasts, an interactive explorer over the real panel and the system's prospective scorecard.",
    sections: [
      { id: "boletines", label: "Boletines en vivo", labelEn: "Live bulletins" },
      { id: "pronostico", label: "Pronóstico", labelEn: "Forecast" },
      { id: "historico", label: "Explorador histórico", labelEn: "Historical explorer" },
      { id: "scorecard", label: "Marcador prospectivo", labelEn: "Prospective scorecard" },
    ],
  },
  {
    path: "/recursos",
    label: "Recursos",
    labelEn: "Resources",
    short: "Recursos",
    shortEn: "Resources",
    blurb: "Descargas reales del proyecto, glosario operativo y referencias IEEE del documento académico.",
    blurbEn: "Real project downloads, a working glossary and IEEE references from the academic document.",
    sections: [
      { id: "descargas", label: "Descargas", labelEn: "Downloads" },
      { id: "glosario", label: "Glosario", labelEn: "Glossary" },
      { id: "referencias", label: "Referencias IEEE", labelEn: "IEEE references" },
    ],
  },
  {
    path: "/asistente",
    label: "Asistente",
    labelEn: "Assistant",
    short: "Asistente",
    shortEn: "Assistant",
    blurb:
      "VisaBot: asistente conversacional con recuperación aumentada (RAG) sobre toda la documentación del proyecto, con respuestas citadas.",
    blurbEn:
      "VisaBot: a retrieval-augmented (RAG) conversational assistant over the whole project documentation, with cited answers.",
    sections: [{ id: "asistente", label: "VisaBot", labelEn: "VisaBot" }],
  },
];

export const routeByPath = (path: string) =>
  ROUTES.find((r) => r.path === path) ?? ROUTES[0];

export const sectionClass = (index: number, id: string) =>
  id === "contacto"
    ? "section section--deep"
    : index % 2 === 1
      ? "section section--alt"
      : "section";

// Field pickers honoring the active language.
export const rLabel = (r: Route, l: Lang) => (l === "en" ? r.labelEn : r.label);
export const rShort = (r: Route, l: Lang) => (l === "en" ? r.shortEn : r.short);
export const rBlurb = (r: Route, l: Lang) => (l === "en" ? r.blurbEn : r.blurb);
export const sLabel = (s: Section, l: Lang) => (l === "en" ? s.labelEn : s.label);

// Locale-aware URLs: en routes live under /en. `localePath` builds an href in
// the active locale; `basePath` strips the /en prefix + trailing slash so the
// site-map (which is locale-agnostic) can be looked up from any pathname.
export const localePath = (path: string, l: Lang): string =>
  l === "en" ? (path === "/" ? "/en" : `/en${path}`) : path;

export function basePath(pathname: string): string {
  const p = (pathname || "/").replace(/\/$/, "") || "/";
  if (p === "/en") return "/";
  return p.replace(/^\/en(?=\/)/, "") || "/";
}
