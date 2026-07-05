// AZ7 — this route renders math too (EDA/FE formulas) → KaTeX styles load
// here and on /anteproyecto only, not globally.
import "katex/dist/katex.min.css";
import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/ingenieria", lang: "en", title: "U.S. Visa Bulletin data engineering", description: "Panel construction, exploratory analysis, feature engineering, MLOps practices, repository structure and a DuckDB star-schema warehouse." });
export default function Page() { return <SectionsPage path="/ingenieria" lang="en" />; }
