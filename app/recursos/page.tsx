import type { Metadata } from "next";
import { RouteHeader } from "@/components/route-header";
import { SectionHTML } from "@/components/section-html";
import { routeByPath, sectionClass } from "@/lib/site-map";

export const metadata: Metadata = {
  title: "Recursos · VisaPredict AI",
  description: "Glosario operativo de 42 términos y 64 referencias IEEE.",
};

export default function Page() {
  const route = routeByPath("/recursos");
  return (
    <>
      <RouteHeader path="/recursos" />
      {route.sections.map((s, i) => (
        <SectionHTML key={s.id} id={s.id} className={sectionClass(i, s.id)} />
      ))}
    </>
  );
}
