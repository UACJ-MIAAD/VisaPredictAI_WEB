import { pageMeta } from "@/lib/seo";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "es", title: "Datos históricos", description: "Boletín en vivo, pronóstico por categoría, explorador interactivo del panel real del U.S. Visa Bulletin y marcador prospectivo del sistema." });
export default function Page() { return <DatosPage />; }
