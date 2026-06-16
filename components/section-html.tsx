import { sectionHtml } from "@/lib/content/sections.generated";

/**
 * Renders a preserved academic section verbatim. Content comes from the
 * build-time transform of index.html (disclaimers stripped, KaTeX rendered).
 * `extraClass` lets a section opt into special wrappers (e.g. ER diagram).
 */
export function SectionHTML({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const html = sectionHtml[id];
  if (!html) {
    return (
      <section id={id} className="section">
        <div className="section-inner">
          <p className="section-sub">Contenido no encontrado: {id}.</p>
        </div>
      </section>
    );
  }
  // The original markup already includes <div class="section-inner">…
  return (
    <section
      id={id}
      className={className ?? "section"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
