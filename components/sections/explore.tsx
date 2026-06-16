import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/site-map";

// Home "table of contents" — routes the reader into each part of the project.
export function Explore() {
  const parts = ROUTES.filter((r) => r.path !== "/");
  return (
    <section id="explorar" className="section section--alt">
      <div className="section-inner">
        <span className="section-tag">Explorar</span>
        <h2 className="section-title">El proyecto, en cuatro partes</h2>
        <p className="section-sub">
          El anteproyecto se divide para leerse con foco: el documento académico,
          la ingeniería de datos, el explorador histórico interactivo y los
          recursos de consulta.
        </p>

        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {parts.map((r, i) => (
            <Link
              key={r.path}
              href={r.path}
              className="group flex flex-col bg-card p-6 transition-colors hover:bg-secondary"
            >
              <span className="font-mono text-xs text-[var(--color-accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 flex items-center gap-2 font-serif text-xl font-bold">
                {r.label}
                <ArrowRight
                  className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {r.blurb}
              </p>
              <span className="mt-3 text-xs text-muted-foreground">
                {r.sections.map((s) => s.label).join(" · ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
