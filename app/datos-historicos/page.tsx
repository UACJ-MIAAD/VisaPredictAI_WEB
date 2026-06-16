import type { Metadata } from "next";
import { RouteHeader } from "@/components/route-header";
import { Boletines } from "@/components/sections/boletines";
import { Historico } from "@/components/sections/historico";

export const metadata: Metadata = {
  title: "Datos históricos · VisaPredict AI",
  description:
    "Boletín en vivo y explorador interactivo del panel real del U.S. Visa Bulletin (dic-2001 → 2026).",
};

export default function Page() {
  return (
    <>
      <RouteHeader path="/datos-historicos" />
      <Boletines />
      <Historico />
    </>
  );
}
