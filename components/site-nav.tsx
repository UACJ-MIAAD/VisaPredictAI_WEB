"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { ROUTES, routeByPath, rShort, rLabel, sLabel, localePath, basePath } from "@/lib/site-map";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

/** Reading progress + scroll-spy over the *current route's* sections. */
function usePageState(sectionIds: string[]) {
  const [active, setActive] = React.useState(sectionIds[0] ?? "");
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    setActive(sectionIds[0] ?? "");
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.3, 0.6] },
    );
    els.forEach((el) => io.observe(el));

    // AZ8: coalesce scroll events into one setState per frame
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [sectionIds]);

  return { active, progress };
}

export function SiteNav() {
  const pathname = usePathname();
  const { lang } = useLang();
  const base = basePath(pathname);
  const route = routeByPath(base);
  const sectionIds = React.useMemo(
    () => route.sections.map((s) => s.id),
    [route],
  );
  const { active, progress } = usePageState(sectionIds);
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  // AX8: real focus trap for the open drawer (WAI-ARIA dialog pattern) — it
  // also moves focus in on open and restores it to the trigger on close.
  const drawerRef = useFocusTrap<HTMLElement>(open);
  // Deterministic focus return: the trap restores document.activeElement from
  // open-time, but pointer clicks don't focus buttons in Safari (and synthetic
  // clicks nowhere), which strands focus on <body> after Escape (audit).
  const openBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasOpen.current && !open) openBtnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  React.useEffect(() => {
    // AZ8: coalesce scroll events into one setState per frame
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setScrolled(window.scrollY > 20);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close mobile menu on route change
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur transition-shadow",
          scrolled && "shadow-[0_2px_14px_rgba(0,0,0,0.06)]",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[var(--container)] items-center gap-4 px-5">
          <Link
            href={localePath("/", lang)}
            className="flex items-center gap-2 font-serif text-lg font-extrabold"
          >
            <Image
              src="/LogoVisaPredictAI.png"
              alt="VisaPredict AI"
              width={28}
              height={28}
            />
            <span>
              VisaPredict<span className="text-[var(--color-accent)]">AI</span>
            </span>
          </Link>

          {/* AX8: horizontal nav only from lg — at 768–1024px it crowded the bar */}
          <ul className="ml-auto hidden items-center gap-1 lg:flex">
            {ROUTES.filter((r) => r.path !== "/").map((r) => {
              const isActive = base === r.path;
              return (
                <li key={r.path}>
                  <Link
                    href={localePath(r.path, lang)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "font-medium text-[var(--color-accent)]",
                    )}
                  >
                    {rShort(r, lang)}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LangToggle />
            <ThemeToggle />
            <button
              type="button"
              ref={openBtnRef}
              aria-label={tr(lang, "openMenu")}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border hover:bg-secondary"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </nav>

        <div
          className="h-0.5 bg-[var(--color-accent)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-label={tr(lang, "readingProgress")}
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </header>

      {/* mobile / overlay menu: routes + current route's sections */}
      <div
        className={cn(
          "fixed inset-0 z-[60] overflow-hidden transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        inert={!open ? true : undefined}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <aside
          ref={drawerRef}
          className={cn(
            "absolute right-0 top-0 flex h-full w-[320px] max-w-[88vw] flex-col border-l border-border bg-background transition-transform duration-300",
            open ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={tr(lang, "menu")}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {tr(lang, "menu")}
            </span>
            <button
              type="button"
              aria-label={tr(lang, "closeMenu")}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border hover:bg-secondary"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {ROUTES.map((r) => {
              const isCurrent = base === r.path;
              return (
                <div key={r.path} className="mb-1">
                  <Link
                    href={localePath(r.path, lang)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary",
                      isCurrent
                        ? "text-[var(--color-accent)]"
                        : "text-foreground",
                    )}
                  >
                    {rLabel(r, lang)}
                  </Link>
                  {isCurrent && (
                    <ul className="ml-3 border-l border-border pl-2">
                      {r.sections.map((s) => (
                        <li key={s.id}>
                          <a
                            href={`#${s.id}`}
                            onClick={() => setOpen(false)}
                            aria-current={active === s.id ? "true" : undefined}
                            className={cn(
                              "block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                              active === s.id &&
                                "font-medium text-foreground",
                            )}
                          >
                            {sLabel(s, lang)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* desktop scroll-spy rail for the current route (lg+, AW-13) */}
      {route.sections.length > 1 && (
        <nav
          aria-label={tr(lang, "menu")}
          className="fixed left-1.5 top-1/2 z-30 hidden -translate-y-1/2 lg:block xl:left-4"
        >
          <ul className="flex flex-col gap-2 2xl:gap-2.5">
            {route.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="group flex items-center gap-2" title={sLabel(s, lang)}>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-border transition-all",
                      active === s.id && "h-2.5 w-2.5 bg-[var(--color-accent)]",
                    )}
                  />
                  {/* AX8: readable plate so the hover label never melts into
                      content it overlaps at 1280–1366px.
                      AY5 (ultrawide): from 2xl the labels are ALWAYS visible
                      (Stripe-docs mini-TOC). The rail's free lane is the gap
                      between the viewport edge and the 1320px rail, so the
                      label is capped to that lane (truncated with the blur
                      plate) and expands to its full text on hover — at ≥1920px
                      the lane is wide enough that the cap never bites. */}
                  <span
                    className={cn(
                      "pointer-events-none whitespace-nowrap rounded bg-[var(--color-bg)]/90 px-1.5 text-xs opacity-0 backdrop-blur transition-opacity group-hover:opacity-100",
                      "2xl:max-w-[calc((100vw-var(--container))/2-3.25rem)] 2xl:truncate 2xl:opacity-100 2xl:group-hover:max-w-none",
                      active === s.id
                        ? "text-foreground 2xl:opacity-100"
                        : "text-muted-foreground",
                    )}
                  >
                    {sLabel(s, lang)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
