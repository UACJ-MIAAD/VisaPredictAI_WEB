"use client";

import { routeByPath, rLabel, rBlurb } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";

// Route title + one-line description (minimal redesign, 19-nov-2026). The logo
// is the way home; sections are reached by scrolling.
export function RouteHeader({ path }: { path: string }) {
  const { lang } = useLang();
  const route = routeByPath(path);
  return (
    <header className="px-5 pb-6 pt-12 md:pt-16">
      <div className="mx-auto max-w-[var(--container)]">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em]">{rLabel(route, lang)}</h1>
        <p className="mt-4 max-w-[62ch] text-[1.05rem] leading-relaxed text-muted-foreground">{rBlurb(route, lang)}</p>
      </div>
    </header>
  );
}
