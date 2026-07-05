import { ogCard, OG_SIZE } from "@/lib/og";
import { routeByPath, rLabel } from "@/lib/site-map";

// BA7 — thin per-route variant of the shared template (lib/og.tsx).
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
const route = routeByPath("/ingenieria");
export const alt = `VisaPredict AI — ${rLabel(route, "en")}`;

export default function OpengraphImage() {
  return ogCard({ lang: "en", title: rLabel(route, "en") });
}
