"use client";

import Link from "next/link";
import { routeByPath, rLabel, rBlurb, localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

// Editorial masthead for a route: kicker + blurb-as-title. The in-page section
// chips it used to render were removed in J1 — the sticky subnav in SiteNav
// now carries the same anchors (numbered), so keeping both duplicated the menu.
export function RouteHeader({ path }: { path: string }) {
  const { lang } = useLang();
  const route = routeByPath(path);
  return (
    <header className="border-b border-border px-5 pb-8 pt-10">
      <div className="mx-auto max-w-[var(--container)]">
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
        {/* BA1: the route title is the page's h1 (interior pages had none);
            classes keep the exact visual style of the previous <p>. */}
        <h1 className="mt-3 max-w-[60ch] font-serif text-2xl font-bold leading-snug tracking-normal md:text-[2rem]">
          {rBlurb(route, lang)}
        </h1>
      </div>
    </header>
  );
}
