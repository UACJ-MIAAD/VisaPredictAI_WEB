import { ArticlePage } from "@/components/pages/article-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/articulo",
  lang: "es",
  title: "¿Cuándo será vigente una fecha de prioridad? · Artículo",
  description:
    "Versión web del artículo científico de VisaPredict AI: pronósticos de primer paso de las fechas de corte del Visa Bulletin, con la clase de referencia como vara de medir.",
});

export default function Page() {
  return <ArticlePage lang="es" />;
}
