import Link from "next/link";
import { routeByPath } from "@/lib/site-map";

// Editorial masthead for a route: kicker, title, blurb, in-page section chips.
export function RouteHeader({ path }: { path: string }) {
  const route = routeByPath(path);
  return (
    <header className="border-b border-border px-5 pb-8 pt-10">
      <div className="mx-auto max-w-[1140px]">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-[var(--color-accent)]"
        >
          ← VisaPredict AI
        </Link>
        <span className="mt-3 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          <span className="h-0.5 w-6 bg-[var(--color-accent)]" aria-hidden />
          {route.label}
        </span>
        <p className="mt-3 max-w-[64ch] font-serif text-2xl font-bold leading-snug md:text-[2rem]">
          {route.blurb}
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Secciones de la página">
          {route.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-[var(--color-accent)] hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
