import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/recursos", lang: "es", title: "Recursos", description: "Descargas reales del proyecto, glosario operativo de 42 términos y 64 referencias IEEE." });
export default function Page() { return <SectionsPage path="/recursos" lang="es" />; }
