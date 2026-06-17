import { sectionHtml } from "@/lib/content/sections.generated";
import { sectionHtmlEn } from "@/lib/content/sections.en.generated";
import type { Lang } from "@/lib/site-map";

/**
 * Server component: renders the preserved academic section for the route's
 * language. Because this is server-only, the (large) content maps never ship to
 * the client — the section is plain prerendered HTML. Language is fixed by the
 * route, so there is no flash and no client cost for content.
 */
export function SectionHTML({
  id,
  className,
  lang,
}: {
  id: string;
  className?: string;
  lang: Lang;
}) {
  const html = (lang === "en" && sectionHtmlEn[id]) || sectionHtml[id];
  if (!html) {
    return (
      <section id={id} className="section">
        <div className="section-inner">
          <p className="section-sub">Content not found: {id}.</p>
        </div>
      </section>
    );
  }
  return (
    <section
      id={id}
      className={className ?? "section"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
