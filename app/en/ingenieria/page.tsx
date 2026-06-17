import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/ingenieria", lang: "en", title: "Data engineering", description: "Panel construction, MLOps practices, repository structure and a DuckDB star-schema warehouse." });
export default function Page() { return <SectionsPage path="/ingenieria" lang="en" />; }
