import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { ROUTES } from "@/lib/site-map";
import { SITE_STATS } from "@/lib/content/site-stats.generated";

export const dynamic = "force-static";

// BA6 — lastModified derived from the data itself: the site's content moves
// with each ingested bulletin, so the first day of the latest bulletin month
// (SITE_STATS.dateLast) is the honest change date; capped at build time in
// case a bulletin is published ahead of its month.
const buildTime = new Date();
const dataDate = new Date(`${SITE_STATS.dateLast}-01T00:00:00Z`);
const lastModified = dataDate < buildTime ? dataDate : buildTime;

// One entry per route AND per locale (Google indexes each language version as
// its own URL; hreflang alternates link the pair in both directions).
export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.flatMap((r) => {
    const p = r.path === "/" ? "" : r.path;
    // trailing slash: Netlify sirve la versión con `/` (301 desde la desnuda);
    // el sitemap debe listar la URL final, no la redirigida.
    const esUrl = `${SITE_URL}${p}/`;
    const enUrl = `${SITE_URL}/en${p}/`;
    const shared = {
      lastModified,
      changeFrequency: "monthly" as const,
      alternates: { languages: { es: esUrl, en: enUrl, "x-default": esUrl } },
    };
    return [
      { url: esUrl, priority: r.path === "/" ? 1 : 0.8, ...shared },
      { url: enUrl, priority: r.path === "/" ? 0.9 : 0.7, ...shared },
    ];
  });
}
