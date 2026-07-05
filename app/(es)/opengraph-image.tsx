// Lives inside the (es) route group (not app/ root): the group cuts the
// metadata cascade, so a root-level card never reached the Spanish home and
// "/" shipped with NO og:image (audit A2). Here Next injects it for "/".
import { ogCard, OG_SIZE } from "@/lib/og";

// BA7 — ES home card, built on the shared template (lib/og.tsx). The EN home
// has its own variant at app/en/opengraph-image.tsx; every route segment ships
// a per-route card too.
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "VisaPredict AI — predicción de fechas de prioridad del U.S. Visa Bulletin";

export default function OpengraphImage() {
  return ogCard({ lang: "es", title: "Predicción de fechas de prioridad" });
}
