import { pageMeta } from "@/lib/seo";
import { HomePage } from "@/components/pages/home-page";
export const metadata = pageMeta({ path: "/", lang: "es", title: "VisaPredict AI · Predicción del U.S. Visa Bulletin", description: "Predicción de fechas de prioridad del U.S. Visa Bulletin por país de cargabilidad, categoría y tabla. Panel multiserie, CRISP-DM, intervalos al 95 %." });
export default function Page() { return <HomePage lang="es" />; }
