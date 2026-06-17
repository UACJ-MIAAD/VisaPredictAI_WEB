import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VisaPredict AI",
    short_name: "VisaPredict",
    description:
      "Forecasting U.S. Visa Bulletin priority dates — MIAAD thesis proposal (UACJ).",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1117",
    theme_color: "#0e1117",
    icons: [
      { src: "/LogoVisaPredictAI.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
