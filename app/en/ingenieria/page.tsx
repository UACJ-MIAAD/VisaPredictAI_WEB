import type { Metadata } from "next";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata: Metadata = { title: "Data engineering · VisaPredict AI" };
export default function Page() { return <SectionsPage path="/ingenieria" lang="en" />; }
