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
      { id: "resumen", label: "Resumen", labelEn: "Abstract" },
      { id: "explorar", label: "Explorar", labelEn: "Explore" },
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
      "Cómo se construyó el panel: pipeline, prácticas MLOps, estructura del repositorio y almacén en esquema estrella.",
    blurbEn:
      "How the panel was built: pipeline, MLOps practices, repository structure and a star-schema warehouse.",
    sections: [
      { id: "datos", label: "Construcción del panel", labelEn: "Building the panel" },
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
      "El corazón empírico: boletín en vivo y el explorador interactivo del panel real del Visa Bulletin.",
    blurbEn:
      "The empirical heart: a live bulletin feed and the interactive explorer over the real Visa Bulletin panel.",
    sections: [
      { id: "boletines", label: "Boletines en vivo", labelEn: "Live bulletins" },
      { id: "historico", label: "Explorador histórico", labelEn: "Historical explorer" },
    ],
  },
  {
    path: "/recursos",
    label: "Recursos",
    labelEn: "Resources",
    short: "Recursos",
    shortEn: "Resources",
    blurb: "Glosario operativo de 42 términos y 64 referencias IEEE.",
    blurbEn: "Working glossary of 42 terms and 64 IEEE references.",
    sections: [
      { id: "glosario", label: "Glosario", labelEn: "Glossary" },
      { id: "referencias", label: "Referencias IEEE", labelEn: "IEEE references" },
    ],
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
