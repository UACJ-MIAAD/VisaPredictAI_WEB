// AZ7 — KaTeX styles load only on the routes that render math (see the ES
// counterpart; same stylesheet, deduped by the bundler).
import "katex/dist/katex.min.css";
import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/anteproyecto", lang: "en", title: "U.S. Visa Bulletin forecasting proposal", description: "Academic document: introduction, theoretical framework, product and validation, CRISP-DM methodology, tables and reproducibility." });
export default function Page() { return <SectionsPage path="/anteproyecto" lang="en" />; }
