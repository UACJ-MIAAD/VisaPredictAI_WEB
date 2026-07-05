// Server component: editorial list of the project's REAL downloadable
// artifacts (/recursos#descargas, AW6). File sizes are measured at build time
// with fs.statSync against the files actually shipped in public/ — never typed
// by hand; a missing file simply omits its size (no invented numbers). The
// reports and the panel CSV regenerate with every new bulletin, so the sizes
// refresh on every build.

import fs from "node:fs";
import path from "node:path";
import type { Lang } from "@/lib/site-map";

// `rel` is the path under public/ (equal to the public URL without the slash).
function sizeOf(rel: string): string | null {
  try {
    const bytes = fs.statSync(path.join(process.cwd(), "public", rel)).size;
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  } catch {
    return null;
  }
}

type Item = {
  href: string;
  label: { es: string; en: string };
  kind: { es: string; en: string };
  size?: string | null;
  external?: boolean;
};

const ITEMS: Item[] = [
  {
    href: "/data/eda_report.pdf",
    size: sizeOf("data/eda_report.pdf"),
    label: { es: "Reporte de análisis exploratorio (EDA)", en: "Exploratory data analysis (EDA) report" },
    kind: { es: "PDF · español", en: "PDF · Spanish" },
  },
  {
    href: "/data/eda_report_en.pdf",
    size: sizeOf("data/eda_report_en.pdf"),
    label: { es: "Reporte de análisis exploratorio (EDA)", en: "Exploratory data analysis (EDA) report" },
    kind: { es: "PDF · inglés", en: "PDF · English" },
  },
  {
    href: "/data/fe_report.pdf",
    size: sizeOf("data/fe_report.pdf"),
    label: { es: "Reporte de ingeniería de características", en: "Feature-engineering report" },
    kind: { es: "PDF · español", en: "PDF · Spanish" },
  },
  {
    href: "/data/fe_report_en.pdf",
    size: sizeOf("data/fe_report_en.pdf"),
    label: { es: "Reporte de ingeniería de características", en: "Feature-engineering report" },
    kind: { es: "PDF · inglés", en: "PDF · English" },
  },
  {
    href: "/data/visa_panel_long.csv",
    size: sizeOf("data/visa_panel_long.csv"),
    label: { es: "Panel histórico completo del Visa Bulletin", en: "Full historical Visa Bulletin panel" },
    kind: { es: "CSV", en: "CSV" },
  },
  {
    href: "/schema_er.svg",
    size: sizeOf("schema_er.svg"),
    label: { es: "Diagrama ER del almacén de datos", en: "Data-warehouse ER diagram" },
    kind: { es: "SVG", en: "SVG" },
  },
  {
    href: "https://github.com/UACJ-MIAAD/VisaPredictAI",
    label: { es: "Repositorio de datos y modelado", en: "Data & modeling repository" },
    kind: { es: "GitHub", en: "GitHub" },
    external: true,
  },
  {
    href: "https://github.com/UACJ-MIAAD/VisaPredictAI_WEB",
    label: { es: "Repositorio de este sitio", en: "This site's repository" },
    kind: { es: "GitHub", en: "GitHub" },
    external: true,
  },
];

const T = {
  es: {
    tag: "Descargas",
    title: "Artefactos reales del proyecto",
    sub: "Reportes, datos y repositorios del proyecto, tal como los publica el pipeline. Los reportes y el panel se regeneran con cada boletín nuevo del Visa Bulletin.",
  },
  en: {
    tag: "Downloads",
    title: "The project's real artifacts",
    sub: "Project reports, data and repositories, exactly as the pipeline publishes them. The reports and the panel regenerate with every new Visa Bulletin.",
  },
};

export function Descargas({ lang, className }: { lang: Lang; className?: string }) {
  const t = T[lang];
  return (
    <section id="descargas" className={className ?? "section"}>
      <div className="section-inner">
        <span className="section-tag">{t.tag}</span>
        <h2 className="section-title">{t.title}</h2>
        <p className="section-sub">{t.sub}</p>

        {/* !pl-0 / list-none beat content.css's `.section-inner ul` padding+markers */}
        <ul className="m-0 list-none !pl-0">
          {ITEMS.map((it) => (
            <li key={`${it.href}-${it.kind.en}`} className="border-t border-[var(--color-rule)]">
              <a
                href={it.href}
                {...(it.external ? { target: "_blank", rel: "noopener" } : { download: true })}
                className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 !no-underline"
              >
                <span className="font-serif text-lg font-bold text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-accent)]">
                  {it.label[lang]}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {it.kind[lang]}
                  {it.size ? ` · ${it.size}` : ""}
                  {it.external ? " ↗" : " ↓"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
