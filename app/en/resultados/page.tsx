import { pageMeta } from "@/lib/seo";
import { ResultadosPage } from "@/components/pages/resultados-page";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
export const metadata = pageMeta({ path: "/resultados", lang: "en", title: "U.S. Visa Bulletin forecasts", description: `The published cutoff and the ${SITE_STATS.horizonMonths}-month forecast of every country × category × table series of the U.S. Visa Bulletin, with 80% and 95% bands.` });
export default function Page() { return <ResultadosPage lang="en" />; }
