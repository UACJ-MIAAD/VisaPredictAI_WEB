import { pageMeta } from "@/lib/seo";
import { ResultadosPage } from "@/components/pages/resultados-page";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
export const metadata = pageMeta({ path: "/resultados", lang: "es", title: "Galería de pronósticos del Visa Bulletin", description: `Todas las series de pronóstico país × categoría × tabla del U.S. Visa Bulletin en una galería filtrable, con el abanico a ${SITE_STATS.horizonMonths} meses y sus bandas al 80 % y 95 %.` });
export default function Page() { return <ResultadosPage lang="es" />; }
