// Single source of truth for the whole site structure.
// Nav, scroll-spy, mobile menu, footer columns and page composition all
// derive from this — change a route/section here and everything follows (DRY).

export type Section = { id: string; label: string };
export type Route = {
  path: string;
  label: string;
  short: string;
  blurb: string;
  sections: Section[];
};

export const ROUTES: Route[] = [
  {
    path: "/",
    label: "Inicio",
    short: "Inicio",
    blurb: "Visión general del proyecto y acceso a cada parte.",
    sections: [
      { id: "inicio", label: "Inicio" },
      { id: "resumen", label: "Resumen" },
      { id: "explorar", label: "Explorar" },
      { id: "autores", label: "Autores" },
      { id: "contacto", label: "Contacto" },
    ],
  },
  {
    path: "/anteproyecto",
    label: "Anteproyecto",
    short: "Anteproyecto",
    blurb:
      "El documento académico: introducción, marco teórico, producto, metodología CRISP-DM, tablas y reproducibilidad.",
    sections: [
      { id: "capi", label: "I · Introducción" },
      { id: "capii", label: "II · Marco teórico" },
      { id: "capiii", label: "III · Producto y validación" },
      { id: "capiv", label: "IV · Metodología CRISP-DM" },
      { id: "tablas", label: "Tablas y figuras" },
      { id: "reproducibilidad", label: "Reproducibilidad" },
    ],
  },
  {
    path: "/ingenieria",
    label: "Ingeniería de datos",
    short: "Ingeniería",
    blurb:
      "Cómo se construyó el panel: pipeline, prácticas MLOps, estructura del repositorio y almacén en esquema estrella.",
    sections: [
      { id: "datos", label: "Construcción del panel" },
      { id: "mlops", label: "Prácticas MLOps" },
      { id: "estructura", label: "Estructura del repo" },
      { id: "modelo", label: "Modelo de datos" },
    ],
  },
  {
    path: "/datos-historicos",
    label: "Datos históricos",
    short: "Datos",
    blurb:
      "El corazón empírico: boletín en vivo y el explorador interactivo del panel real del Visa Bulletin.",
    sections: [
      { id: "boletines", label: "Boletines en vivo" },
      { id: "historico", label: "Explorador histórico" },
    ],
  },
  {
    path: "/recursos",
    label: "Recursos",
    short: "Recursos",
    blurb: "Glosario operativo de 42 términos y 64 referencias IEEE.",
    sections: [
      { id: "glosario", label: "Glosario" },
      { id: "referencias", label: "Referencias IEEE" },
    ],
  },
];

export const routeByPath = (path: string) =>
  ROUTES.find((r) => r.path === path) ?? ROUTES[0];

// Background alternation helper so adjacent sections never blend.
export const sectionClass = (index: number, id: string) =>
  id === "contacto"
    ? "section section--deep"
    : index % 2 === 1
      ? "section section--alt"
      : "section";
