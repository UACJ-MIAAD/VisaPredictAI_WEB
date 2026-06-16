import type { Metadata } from "next";
import { RouteHeader } from "@/components/route-header";
import { SectionHTML } from "@/components/section-html";
import { routeByPath, sectionClass } from "@/lib/site-map";

export const metadata: Metadata = {
  title: "Anteproyecto · VisaPredict AI",
  description:
    "Documento académico: introducción, marco teórico, producto y validación, metodología CRISP-DM, tablas y reproducibilidad.",
};

export default function Page() {
  const route = routeByPath("/anteproyecto");
  return (
    <>
      <RouteHeader path="/anteproyecto" />
      {route.sections.map((s, i) => (
        <SectionHTML key={s.id} id={s.id} className={sectionClass(i, s.id)} />
      ))}
    </>
  );
}
