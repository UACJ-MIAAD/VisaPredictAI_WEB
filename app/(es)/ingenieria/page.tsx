// AZ7 — this route renders math too (EDA/FE formulas) → KaTeX styles load
// here and on /anteproyecto only, not globally.
import "katex/dist/katex.min.css";
import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/ingenieria", lang: "es", title: "Ingeniería de datos del Visa Bulletin", description: "Construcción del panel, análisis exploratorio, ingeniería de características, prácticas MLOps, estructura del repositorio y almacén en esquema estrella DuckDB." });
export default function Page() { return <SectionsPage path="/ingenieria" lang="es" />; }
