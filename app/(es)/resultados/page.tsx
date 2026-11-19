import { pageMeta } from "@/lib/seo";
import { ResultadosPage } from "@/components/pages/resultados-page";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
export const metadata = pageMeta({ path: "/resultados", lang: "es", title: "Pronósticos del Visa Bulletin", description: `El corte publicado y el pronóstico a ${SITE_STATS.horizonMonths} meses de cada serie país × categoría × tabla del U.S. Visa Bulletin, con bandas al 80 % y 95 %.` });
export default function Page() { return <ResultadosPage lang="es" />; }
