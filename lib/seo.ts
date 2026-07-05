import type { Metadata } from "next";
import type { Lang } from "@/lib/site-map";

export const SITE_URL = "https://visapredictai.com";

// Per-page metadata with correct canonical + hreflang alternates (es ⇄ en).
// Every page should call this so search engines pair the two languages and
// social cards render rich previews.
export function pageMeta({
  path,
  lang,
  title,
  description,
}: {
  path: string; // locale-agnostic base path, e.g. "/anteproyecto" or "/"
  lang: Lang;
  title: string;
  description: string;
}): Metadata {
  const esUrl = `${SITE_URL}${path === "/" ? "" : path}`;
  const enUrl = `${SITE_URL}/en${path === "/" ? "" : path}`;
  const canonical = lang === "en" ? enUrl : esUrl;

  // BA7 — each route segment ships its own generated card (opengraph-image.tsx
  // next to the page). Do NOT set images here: the exported file gets a content
  // hash suffix (opengraph-image-<hash>) and Next injects the correct og:image /
  // twitter:image tags for the segment automatically; a manual URL would 404.
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: { es: esUrl, en: enUrl, "x-default": esUrl },
    },
    openGraph: {
      type: "website",
      siteName: "VisaPredict AI",
      title,
      description,
      url: canonical,
      locale: lang === "en" ? "en_US" : "es_MX",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// BA7 — structured data per locale (rendered by app/(es)/layout.tsx and
// app/en/layout.tsx as <script type="application/ld+json">). inLanguage and
// the site URL follow the locale; the article headline stays in the language
// it describes.
export function siteJsonLd(lang: Lang): string {
  const url = lang === "en" ? `${SITE_URL}/en` : SITE_URL;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url,
        name: "VisaPredict AI",
        inLanguage: lang,
      },
      {
        "@type": "ScholarlyArticle",
        headline:
          lang === "en"
            ? "Predicting priority dates in the U.S. Visa Bulletin by country or chargeability area, immigration category and table type"
            : "Predicción de fechas de prioridad en el Visa Bulletin de Estados Unidos considerando país o área de cargabilidad, categoría migratoria y tipo de tabla",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: lang,
        author: {
          "@type": "Person",
          name: "Javier Augusto Rebull Saucedo",
        },
        publisher: {
          "@type": "CollegeOrUniversity",
          name: "Universidad Autónoma de Ciudad Juárez",
        },
        about:
          lang === "en"
            ? "U.S. Visa Bulletin priority-date forecasting (MIAAD thesis proposal)"
            : "Pronóstico de fechas de prioridad del U.S. Visa Bulletin (anteproyecto MIAAD)",
      },
    ],
  });
}
