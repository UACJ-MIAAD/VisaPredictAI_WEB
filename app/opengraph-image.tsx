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
