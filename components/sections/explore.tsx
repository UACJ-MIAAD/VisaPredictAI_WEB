"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES, rLabel, rBlurb, sLabel, localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

export function Explore() {
  const { lang } = useLang();
  const parts = ROUTES.filter((r) => r.path !== "/");
  return (
    <section id="explorar" className="section section--alt">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "exploreKicker")}</span>
        <h2 className="section-title">{tr(lang, "exploreTitle")}</h2>
        <p className="section-sub">{tr(lang, "exploreSub")}</p>

        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {parts.map((r, i) => (
            <Link
              key={r.path}
              href={localePath(r.path, lang)}
              className="group border-t-2 border-[var(--color-rule)] pt-3"
            >
              <span className="font-mono text-xs text-[var(--color-accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 flex items-center gap-2 font-serif text-2xl font-bold">
                {rLabel(r, lang)}
                <ArrowRight
                  className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </h3>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
                {rBlurb(r, lang)}
              </p>
              <span className="mt-3 block text-xs text-muted-foreground">
                {r.sections.map((s) => sLabel(s, lang)).join(" · ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
