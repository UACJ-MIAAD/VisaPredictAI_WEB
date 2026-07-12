"use client";

// J1 (plan auditoría 3 repos, 2026-07-12) — navigation "Alternativa A":
// editorial masthead + sticky in-page subnav, replacing the left scroll-spy
// rail the author rejected. Structure (all sticky as one block):
//   row 1  masthead: logo · global routes (lg+, full labels, never truncated)
//          · lang/theme toggles · hamburger (mobile only — no redundant
//          hamburger at lg+, plan criterion)
//   row 2  subnav: numbered section anchors of the CURRENT route (desktop:
//          horizontally scrollable strip; mobile: "On this page ▾" disclosure)
//          + reading percent readout
//   row 3  2px reading-progress bar
// Every item derives from lib/site-map via lib/nav-model (pure, unit-tested):
// section ids are consumed verbatim, so no deep link changes.

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { ROUTES, routeByPath, rLabel, localePath, basePath } from "@/lib/site-map";
import { mastheadItems, subnavItems, readingProgress } from "@/lib/nav-model";
import { track } from "@/lib/analytics";
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
        setProgress(readingProgress(h.scrollTop, h.scrollHeight, h.clientHeight));
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
  const masthead = React.useMemo(() => mastheadItems(base, lang), [base, lang]);
  const subnav = React.useMemo(() => subnavItems(base, lang), [base, lang]);

  const [open, setOpen] = React.useState(false); // mobile drawer (global routes)
  const [pageOpen, setPageOpen] = React.useState(false); // mobile "on this page" disclosure
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

  // close both menus on route change
  React.useEffect(() => {
    setOpen(false);
    setPageOpen(false);
  }, [pathname]);

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

  // ── "On this page" disclosure (mobile subnav): Escape returns focus to the
  // trigger; a pointerdown outside closes it. Non-modal (WAI-ARIA disclosure),
  // so no focus trap — Tab naturally moves through the list.
  const pageBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const pageBoxRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!pageOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPageOpen(false);
        pageBtnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (pageBoxRef.current && !pageBoxRef.current.contains(e.target as Node))
        setPageOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [pageOpen]);

  // ── Navigation-success analytics: a subnav click records its target and the
  // event fires when the scroll-spy actually REACHES that section (arrival,
  // not click). Global route clicks fire on click — the router guarantees the
  // landing. No pattern invented: uses the existing track() helper.
  const pendingSection = React.useRef<{ id: string; at: number } | null>(null);
  const onSubnavClick = (id: string) => {
    pendingSection.current = { id, at: Date.now() };
    setPageOpen(false);
  };
  React.useEffect(() => {
    const p = pendingSection.current;
    if (p && p.id === active && Date.now() - p.at < 15000) {
      pendingSection.current = null;
      track("Nav", { level: "section", to: `${base}#${active}` });
    }
  }, [active, base]);

  // Keep the active item visible inside the scrollable subnav strip (desktop).
  const stripRef = React.useRef<HTMLUListElement | null>(null);
  React.useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !active) return;
    const el = strip.querySelector<HTMLElement>(
      `a[href="#${CSS.escape(active)}"]`,
    );
    if (!el) return;
    const li = el.parentElement as HTMLElement | null;
    const left = (li ?? el).offsetLeft;
    const width = (li ?? el).offsetWidth;
    const pad = 24;
    let target: number | null = null;
    if (left < strip.scrollLeft + pad) target = left - pad;
    else if (left + width > strip.scrollLeft + strip.clientWidth - pad)
      target = left + width - strip.clientWidth + pad;
    if (target !== null) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      strip.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
    }
  }, [active]);

  const pct = Math.round(progress);
  const activeItem = subnav.find((s) => s.id === active) ?? subnav[0];

  return (
    <>
      {/* Sticky (in-flow) header: masthead + subnav + progress. Being sticky
          instead of fixed lets its height vary per route (subnav only when the
          page has ≥2 sections) without padding compensation in the shell. */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur transition-shadow",
          scrolled && "shadow-[0_2px_14px_rgba(0,0,0,0.06)]",
        )}
      >
        {/* ── row 1: global masthead */}
        <div className="mx-auto flex h-16 max-w-[var(--container)] items-center gap-2 px-5 sm:gap-4">
          <Link
            href={localePath("/", lang)}
            aria-current={base === "/" ? "page" : undefined}
            className="flex shrink-0 items-center gap-2 font-serif text-lg font-extrabold"
          >
            {/* QW4: logo-64.png (2 kB, 64×64 from build-icons.mjs) — the 256 kB
                original renders at 28 px here; keep the original for og/content. */}
            <Image
              src="/logo-64.png"
              alt="VisaPredict AI"
              width={28}
              height={28}
            />
            {/* Below 400px the toggles block (44px targets, non-negotiable)
                plus the full wordmark exceeds the viewport — the sticky header
                is in-flow now, so that WOULD become page overflow (the old
                fixed header simply clipped it invisibly). Icon-only there; the
                link keeps its accessible name from the img alt. */}
            <span className="max-[399px]:hidden">
              VisaPredict<span className="text-[var(--color-accent)]">AI</span>
            </span>
          </Link>

          {/* Global routes inline from lg. Full (short-form) labels from
              site-map, whitespace-nowrap and no max-width caps: they render
              whole at every width incl. 1536/3440px (plan criterion). */}
          <nav aria-label={tr(lang, "navPrimary")} className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {masthead.map((it) => (
                <li key={it.path}>
                  <Link
                    href={it.href}
                    aria-current={it.active ? "page" : undefined}
                    onClick={() =>
                      track("Nav", { level: "global", to: it.path, ui: "masthead" })
                    }
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                      it.active && "font-medium text-[var(--color-accent)]",
                    )}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LangToggle />
            <ThemeToggle />
            {/* Mobile-only disclosure for the global routes: at lg+ the routes
                are inline above, so no redundant hamburger (plan criterion). */}
            <button
              type="button"
              ref={openBtnRef}
              aria-label={tr(lang, "openMenu")}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border hover:bg-secondary lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* ── row 2: in-page subnav (numbered editorial anchors) */}
        {subnav.length > 0 && (
          <div className="border-t border-border">
            <div className="mx-auto flex h-11 max-w-[var(--container)] items-center gap-3 px-5">
              {/* desktop: horizontally scrollable strip (scroll-snap; overflow
                  stays inside the strip — never page-level) */}
              <nav
                aria-label={tr(lang, "navOnPage")}
                className="hidden min-w-0 flex-1 self-stretch lg:block"
              >
                <ul ref={stripRef} className="subnav-strip relative flex h-full items-stretch gap-1">
                  {subnav.map((s) => {
                    const isActive = active === s.id;
                    return (
                      <li key={s.id} className="flex snap-start items-stretch">
                        <a
                          href={s.href}
                          aria-current={isActive ? "location" : undefined}
                          onClick={() => onSubnavClick(s.id)}
                          className={cn(
                            "flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                            isActive &&
                              "border-[var(--color-accent)] font-medium text-foreground",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "font-mono text-[0.65rem]",
                              isActive
                                ? "text-[var(--color-accent)]"
                                : "text-muted-foreground/70",
                            )}
                          >
                            {s.num}
                          </span>
                          {s.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* mobile: "On this page ▾" disclosure with the same items */}
              <div ref={pageBoxRef} className="relative min-w-0 flex-1 lg:hidden">
                <button
                  type="button"
                  ref={pageBtnRef}
                  aria-expanded={pageOpen}
                  aria-controls="onpage-panel"
                  onClick={() => setPageOpen((v) => !v)}
                  className="flex h-11 w-full min-w-0 items-center gap-1.5 text-sm text-foreground"
                >
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {tr(lang, "navOnPage")}
                  </span>
                  {activeItem && (
                    <span className="min-w-0 truncate font-medium">
                      <span aria-hidden className="mr-1 font-mono text-[0.65rem] text-[var(--color-accent)]">
                        {activeItem.num}
                      </span>
                      {activeItem.label}
                    </span>
                  )}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      pageOpen && "rotate-180",
                    )}
                  />
                </button>
                <nav
                  id="onpage-panel"
                  aria-label={tr(lang, "navOnPage")}
                  hidden={!pageOpen}
                  className="absolute inset-x-0 top-full z-50 max-h-[60vh] overflow-y-auto rounded-b-lg border border-t-0 border-border bg-background shadow-[0_10px_28px_rgba(0,0,0,0.14)]"
                >
                  <ul className="py-1">
                    {subnav.map((s) => {
                      const isActive = active === s.id;
                      return (
                        <li key={s.id}>
                          <a
                            href={s.href}
                            aria-current={isActive ? "location" : undefined}
                            onClick={() => onSubnavClick(s.id)}
                            className={cn(
                              "flex min-h-11 items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                              isActive && "font-medium text-foreground",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "font-mono text-[0.65rem]",
                                isActive
                                  ? "text-[var(--color-accent)]"
                                  : "text-muted-foreground/70",
                              )}
                            >
                              {s.num}
                            </span>
                            {s.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              {/* reading percent readout (the progressbar below carries the
                  accessible value — this visual echo stays aria-hidden) */}
              <span
                aria-hidden
                className="shrink-0 font-mono text-[0.65rem] tabular-nums text-muted-foreground"
              >
                {pct} %
              </span>
            </div>
          </div>
        )}

        {/* ── row 3: reading progress */}
        <div
          className="h-0.5 bg-[var(--color-accent)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-label={tr(lang, "readingProgress")}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </header>

      {/* mobile drawer: GLOBAL routes only — the current page's sections live
          in the "On this page" disclosure above (one menu per concern, J1). */}
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
          <nav aria-label={tr(lang, "navPrimary")} className="flex-1 overflow-y-auto p-3">
            <ul>
              {ROUTES.map((r) => {
                const isCurrent = base === r.path;
                return (
                  <li key={r.path} className="mb-1">
                    <Link
                      href={localePath(r.path, lang)}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => {
                        // close explicitly: a tap on the CURRENT route doesn't
                        // change pathname, so the route-change effect won't fire
                        setOpen(false);
                        track("Nav", { level: "global", to: r.path, ui: "drawer" });
                      }}
                      className={cn(
                        "block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary",
                        isCurrent
                          ? "text-[var(--color-accent)]"
                          : "text-foreground",
                      )}
                    >
                      {rLabel(r, lang)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>
    </>
  );
}
