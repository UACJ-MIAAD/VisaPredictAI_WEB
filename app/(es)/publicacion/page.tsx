import { PublicationPage } from "@/components/pages/publication-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/publicacion",
  lang: "es",
  title: "Plan de publicación en revista indexada",
  description:
    "Plan verificable para llevar VisaPredict AI a una revista indexada: tres revistas objetivo, mesa redonda de expertos, estimador de fecha de turno a 10–30 años y ruta semanal.",
});

export default function Page() {
  return <PublicationPage lang="es" />;
}
