import { pageMeta } from "@/lib/seo";
import { ResultadosPage } from "@/components/pages/resultados-page";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
export const metadata = pageMeta({ path: "/resultados", lang: "en", title: "U.S. Visa Bulletin forecast gallery", description: `Every country × category × table forecast series of the U.S. Visa Bulletin in a filterable gallery, with the ${SITE_STATS.horizonMonths}-month fan chart and its 80% and 95% bands.` });
export default function Page() { return <ResultadosPage lang="en" />; }
