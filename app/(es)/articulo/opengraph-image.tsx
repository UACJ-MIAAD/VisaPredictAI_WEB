import { ogCard, OG_SIZE } from "@/lib/og";
import { routeByPath, rLabel } from "@/lib/site-map";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
const route = routeByPath("/articulo");
export const alt = `VisaPredict AI — ${rLabel(route, "es")}`;

export default function OpengraphImage() {
  return ogCard({
    lang: "es",
    title: rLabel(route, "es"),
    accent: "Artículo científico",
    sub: "Pronósticos de primer paso del Visa Bulletin",
  });
}
