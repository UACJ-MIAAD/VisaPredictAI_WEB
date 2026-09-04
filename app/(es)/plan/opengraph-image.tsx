import { ogCard, OG_SIZE } from "@/lib/og";
import { planStats } from "@/lib/plan-data";
import { routeByPath, rLabel } from "@/lib/site-map";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
const route = routeByPath("/plan");
const progress = planStats().percent;
export const alt = `VisaPredict AI — ${rLabel(route, "es")}`;

export default function OpengraphImage() {
  return ogCard({
    lang: "es",
    title: rLabel(route, "es"),
    accent: `MLOps · ${progress} %`,
    sub: "Épicas · historias de usuario · evidencia verificable",
  });
}
