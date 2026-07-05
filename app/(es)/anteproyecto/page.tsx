// AZ7 — KaTeX styles load only here: the academic sections of this route are
// the only ones that render math (the old import in app/globals.css shipped
// ~23 kB of CSS to every page).
import "katex/dist/katex.min.css";
import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/anteproyecto", lang: "es", title: "Anteproyecto de predicción del Visa Bulletin", description: "Documento académico: introducción, marco teórico, producto y validación, metodología CRISP-DM, tablas y reproducibilidad." });
export default function Page() { return <SectionsPage path="/anteproyecto" lang="es" />; }
