import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/anteproyecto", lang: "es", title: "Anteproyecto", description: "Documento académico: introducción, marco teórico, producto y validación, metodología CRISP-DM, tablas y reproducibilidad." });
export default function Page() { return <SectionsPage path="/anteproyecto" lang="es" />; }
