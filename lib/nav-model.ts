// Pure derivations for the site chrome (US J1 — masthead + editorial subnav).
// Everything here is computed from lib/site-map (single source of truth for
// routes/sections/anchors): the components render these items verbatim, so
// navigation can be unit-tested without a DOM and the anchors can NEVER drift
// from the section ids the pages actually use (deep-link invariant).

import {
  ROUTES,
  routeByPath,
  rShort,
  sLabel,
  localePath,
  type Lang,
} from "@/lib/site-map";

export type MastheadItem = {
  path: string; // locale-agnostic base path (analytics destination)
  href: string; // locale-aware href
  label: string; // full short-form label — rendered whole, never truncated
  active: boolean;
};

/** Global masthead items: every route except home (the logo is the home link). */
export function mastheadItems(base: string, lang: Lang): MastheadItem[] {
  return ROUTES.filter((r) => r.path !== "/").map((r) => ({
    path: r.path,
    href: localePath(r.path, lang),
    label: rShort(r, lang),
    active: base === r.path,
  }));
}

export type SubnavItem = {
  id: string; // section id — EXACTLY the id used in the page markup
  href: string; // "#id" (hash-only: same-page anchor, no page reload)
  num: string; // editorial two-digit ordinal ("01", "02", …)
  label: string;
};

/**
 * In-page subnav for the current route: numbered section anchors. Routes with
 * a single section (e.g. /asistente) get no subnav — nothing to navigate.
 */
export function subnavItems(base: string, lang: Lang): SubnavItem[] {
  const route = routeByPath(base);
  if (route.sections.length < 2) return [];
  return route.sections.map((s, i) => ({
    id: s.id,
    href: `#${s.id}`,
    num: String(i + 1).padStart(2, "0"),
    label: sLabel(s, lang),
  }));
}

/**
 * Reading progress in percent (0–100), clamped. Pure so the math is testable:
 * the component feeds it scrollTop/scrollHeight/clientHeight per frame.
 */
export function readingProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const max = scrollHeight - clientHeight;
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (scrollTop / max) * 100));
}
