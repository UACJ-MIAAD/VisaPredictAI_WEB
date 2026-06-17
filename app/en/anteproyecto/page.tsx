import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/anteproyecto", lang: "en", title: "Proposal", description: "Academic document: introduction, theoretical framework, product and validation, CRISP-DM methodology, tables and reproducibility." });
export default function Page() { return <SectionsPage path="/anteproyecto" lang="en" />; }
