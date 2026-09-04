import { PlanPage } from "@/components/pages/plan-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/plan",
  lang: "es",
  title: "Plan MLOps y avance",
  description:
    "Dashboard verificable del plan MLOps de VisaPredict AI: porcentaje de avance, estado por épica, historias de usuario, ruta y bitácora.",
});

export default function Page() {
  return <PlanPage lang="es" />;
}
