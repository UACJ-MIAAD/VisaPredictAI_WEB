import { pageMeta } from "@/lib/seo";
import { ResultadosPage } from "@/components/pages/resultados-page";
export const metadata = pageMeta({ path: "/resultados", lang: "en", title: "U.S. Visa Bulletin forecast gallery", description: "Every country × category × table forecast series of the U.S. Visa Bulletin in a filterable gallery, with the 12-month fan chart and its 80% and 95% bands." });
export default function Page() { return <ResultadosPage lang="en" />; }
