import { pageMeta } from "@/lib/seo";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "en", title: `U.S. Visa Bulletin historical data (${SITE_STATS.dateFirst.slice(0, 4)}\u2013${SITE_STATS.dateLast.slice(0, 4)})`, description: "Live bulletin, per-category forecasts, an interactive explorer over the real U.S. Visa Bulletin panel and the system's prospective scorecard." });
export default function Page() { return <DatosPage />; }
