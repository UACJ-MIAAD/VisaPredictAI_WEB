import { ogCard, OG_SIZE } from "@/lib/og";

// BA7 — EN home card (original wording of the pre-BA7 single card).
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "VisaPredict AI — predicting U.S. Visa Bulletin priority dates";

export default function OpengraphImage() {
  return ogCard({ lang: "en", title: "Predicting priority dates in the" });
}
