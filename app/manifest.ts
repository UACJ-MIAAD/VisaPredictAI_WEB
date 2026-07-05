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
    // AZ3b — real raster sizes from scripts/build-icons.mjs (the old entry
    // pointed the 358×360 master logo declared as 512×512). Maskable variants
    // keep the logo inside the 80% safe zone on a solid background.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
