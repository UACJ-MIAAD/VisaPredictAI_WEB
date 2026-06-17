import type { Metadata } from "next";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata: Metadata = { title: "Resources · VisaPredict AI" };
export default function Page() { return <SectionsPage path="/recursos" lang="en" />; }
