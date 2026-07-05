import { SiteShell } from "@/components/site-shell";
import { siteJsonLd } from "@/lib/seo";

// BA8: no layout-level description here — every page already sets its own via
// pageMeta(), so a layout description only shadowed it asymmetrically vs (es).

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* BA7: locale-scoped structured data (inLanguage/url = en). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: siteJsonLd("en") }}
      />
      <SiteShell lang="en">{children}</SiteShell>
    </>
  );
}
