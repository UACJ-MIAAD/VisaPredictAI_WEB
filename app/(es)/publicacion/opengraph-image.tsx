import { ogCard, OG_SIZE } from "@/lib/og";
import { routeByPath, rLabel } from "@/lib/site-map";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
const route = routeByPath("/publicacion");
export const alt = `VisaPredict AI — ${rLabel(route, "es")}`;

export default function OpengraphImage() {
  return ogCard({
    lang: "es",
    title: rLabel(route, "es"),
    accent: "Revista indexada",
    sub: "Revistas · mesa redonda · fecha de turno a 10–30 años",
  });
}
