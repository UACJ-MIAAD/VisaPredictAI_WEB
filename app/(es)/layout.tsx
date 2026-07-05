import { SiteShell } from "@/components/site-shell";
import { siteJsonLd } from "@/lib/seo";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* BA7: locale-scoped structured data (inLanguage/url = es). A JSON-LD
          script is a data block — valid inside <body> and inert under CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: siteJsonLd("es") }}
      />
      <SiteShell lang="es">{children}</SiteShell>
    </>
  );
}
