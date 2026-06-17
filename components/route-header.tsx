"use client";

import Link from "next/link";
import { routeByPath, rLabel, rBlurb, sLabel, localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

// Editorial masthead for a route: kicker, blurb, in-page section chips.
export function RouteHeader({ path }: { path: string }) {
  const { lang } = useLang();
  const route = routeByPath(path);
  return (
    <header className="border-b border-border px-5 pb-8 pt-10">
      <div className="mx-auto max-w-[1140px]">
        <Link
          href={localePath("/", lang)}
          className="text-xs text-muted-foreground hover:text-[var(--color-accent)]"
        >
          {tr(lang, "rhBack")}
        </Link>
        <span className="mt-3 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          <span className="h-0.5 w-6 bg-[var(--color-accent)]" aria-hidden />
          {rLabel(route, lang)}
        </span>
        <p className="mt-3 max-w-[60ch] font-serif text-2xl font-bold leading-snug md:text-[2rem]">
          {rBlurb(route, lang)}
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label={tr(lang, "menu")}>
          {route.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-[var(--color-accent)] hover:text-foreground"
            >
              {sLabel(s, lang)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
