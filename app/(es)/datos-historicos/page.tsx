import { pageMeta } from "@/lib/seo";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata = pageMeta({ path: "/datos-historicos", lang: "es", title: "Datos históricos", description: "Boletín en vivo y explorador interactivo del panel real del U.S. Visa Bulletin (dic-2001 → 2026)." });
export default function Page() { return <DatosPage />; }
