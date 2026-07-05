import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/ingenieria", lang: "es", title: "Ingeniería de datos", description: "Construcción del panel, análisis exploratorio, ingeniería de características, prácticas MLOps, estructura del repositorio y almacén en esquema estrella DuckDB." });
export default function Page() { return <SectionsPage path="/ingenieria" lang="es" />; }
