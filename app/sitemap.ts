import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { ROUTES } from "@/lib/site-map";

export const dynamic = "force-static";

// One entry per route, with es/en hreflang alternates.
export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => {
    const p = r.path === "/" ? "" : r.path;
    const esUrl = `${SITE_URL}${p}`;
    const enUrl = `${SITE_URL}/en${p}`;
    return {
      url: esUrl,
      changeFrequency: "monthly" as const,
      priority: r.path === "/" ? 1 : 0.8,
      alternates: { languages: { es: esUrl, en: enUrl } },
    };
  });
}
