"use client";

import { sectionHtml } from "@/lib/content/sections.generated";
import { sectionHtmlEn } from "@/lib/content/sections.en.generated";
import { useLang } from "@/components/lang-provider";

/**
 * Renders a preserved academic section. Spanish from the source transform;
 * English from the translated set (content/en/*). Falls back to Spanish if a
 * translation is missing.
 */
export function SectionHTML({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const { lang } = useLang();
  const html = (lang === "en" && sectionHtmlEn[id]) || sectionHtml[id];
  if (!html) {
    return (
      <section id={id} className="section">
        <div className="section-inner">
          <p className="section-sub">Contenido no encontrado: {id}.</p>
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
