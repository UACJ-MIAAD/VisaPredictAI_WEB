"use client";

// Discreet "next part" link at the end of every route's <main> (AW7): derived
// from the ROUTES order in lib/site-map (single source of truth). The number
// matches the Explore grid's numbering (home excluded → ROUTES index). No
// wrap-around: the last route points back home, without a number.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { ROUTES, basePath, localePath, rLabel } from "@/lib/site-map";

export function NextPart() {
  const { lang } = useLang();
  const pathname = usePathname() || "/";
  const i = ROUTES.findIndex((r) => r.path === basePath(pathname));
  if (i === -1) return null; // unknown route (404) → no next link

  const isLast = i === ROUTES.length - 1;
  const next = isLast ? ROUTES[0] : ROUTES[i + 1];
  // Explore numbers the parts 01..05 over ROUTES minus home; mirror it here.
  const num = isLast ? null : String(i + 1).padStart(2, "0");

  return (
    <nav aria-label={tr(lang, "nextLabel")} className="border-t border-border px-6 py-10">
      <div className="section-inner">
        <Link href={localePath(next.path, lang)} className="group inline-flex min-h-11 flex-wrap items-center gap-x-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {tr(lang, "nextLabel")}:
          </span>
          <span className="inline-flex items-center gap-2 font-serif text-xl font-bold transition-colors group-hover:text-[var(--color-accent)]">
            {num ? (
              <>
                <span className="font-mono text-sm font-normal text-[var(--color-accent)]">{num}</span> ·{" "}
              </>
            ) : null}
            {rLabel(next, lang)}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      </div>
    </nav>
  );
}
