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
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
