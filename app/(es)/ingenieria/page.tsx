import type { Metadata } from "next";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata: Metadata = { title: "Ingeniería de datos · VisaPredict AI" };
export default function Page() { return <SectionsPage path="/ingenieria" lang="es" />; }
