import { ogCard, OG_SIZE } from "@/lib/og";
import { routeByPath, rLabel } from "@/lib/site-map";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
const route = routeByPath("/publicacion");
export const alt = `VisaPredict AI — ${rLabel(route, "en")}`;

export default function OpengraphImage() {
  return ogCard({
    lang: "en",
    title: rLabel(route, "en"),
    accent: "Indexed journal",
    sub: "Journals · round table · 10–30 year turn date",
  });
}
