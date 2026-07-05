import { pageMeta } from "@/lib/seo";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "en", title: "Historical data", description: "Live bulletin, per-category forecasts, an interactive explorer over the real U.S. Visa Bulletin panel and the system's prospective scorecard." });
export default function Page() { return <DatosPage />; }
