import type { Metadata } from "next";
import { RouteHeader } from "@/components/route-header";
import { SectionHTML } from "@/components/section-html";
import { routeByPath, sectionClass } from "@/lib/site-map";

export const metadata: Metadata = {
  title: "Ingeniería de datos · VisaPredict AI",
  description:
    "Construcción del panel, prácticas MLOps, estructura del repositorio y almacén dimensional en esquema estrella (DuckDB).",
};

export default function Page() {
  const route = routeByPath("/ingenieria");
  return (
    <>
      <RouteHeader path="/ingenieria" />
      {route.sections.map((s, i) => (
        <SectionHTML key={s.id} id={s.id} className={sectionClass(i, s.id)} />
      ))}
    </>
  );
}
