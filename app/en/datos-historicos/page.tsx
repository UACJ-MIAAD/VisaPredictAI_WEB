import type { Metadata } from "next";
import { DatosPage } from "@/components/pages/datos-page";
export const metadata: Metadata = { title: "Historical data · VisaPredict AI" };
export default function Page() { return <DatosPage />; }
