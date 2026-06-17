import { RouteHeader } from "@/components/route-header";
import { SectionHTML } from "@/components/section-html";
import { routeByPath, sectionClass, type Lang } from "@/lib/site-map";

// Shared body for the section-list routes (proposal / engineering / resources),
// rendered under both / and /en — language is passed from the locale page.
export function SectionsPage({ path, lang }: { path: string; lang: Lang }) {
  const route = routeByPath(path);
  return (
    <>
      <RouteHeader path={path} />
      {route.sections.map((s, i) => (
        <SectionHTML key={s.id} id={s.id} lang={lang} className={sectionClass(i, s.id)} />
      ))}
    </>
  );
}
