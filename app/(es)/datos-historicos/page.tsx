import { pageMeta } from "@/lib/seo";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "es", title: `Datos históricos del Visa Bulletin (${SITE_STATS.dateFirst.slice(0, 4)}\u2013${SITE_STATS.dateLast.slice(0, 4)})`, description: "Boletín en vivo, pronóstico por categoría, explorador interactivo del panel real del U.S. Visa Bulletin y marcador prospectivo del sistema." });
export default function Page() { return <DatosPage lang="es" />; }
