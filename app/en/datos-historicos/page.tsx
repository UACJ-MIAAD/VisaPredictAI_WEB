import { pageMeta } from "@/lib/seo";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "en", title: "Historical data", description: "Live bulletin feed and an interactive explorer over the real U.S. Visa Bulletin panel (Dec-2001 → 2026)." });
export default function Page() { return <DatosPage />; }
