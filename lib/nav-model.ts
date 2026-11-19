// Pure derivations for the site chrome. Everything here is computed from
// lib/site-map (single source of truth for routes), so navigation can be
// unit-tested without a DOM.
//
// Minimal redesign (19-nov-2026): the header carries only the four places a
// visitor goes to — forecasts, data, the project document and VisaBot. The
// remaining routes (engineering, resources, plan) live in the footer and in the
// mobile menu. The numbered in-page subnav and the reading-progress bar were
// removed: every page is short enough to scroll, and anchors still work.

import { ROUTES, rShort, rLabel, localePath, type Lang } from "@/lib/site-map";

/** The header's routes, in display order. VisaBot goes last (it is the call to action). */
export const PRIMARY_PATHS = ["/resultados", "/datos-historicos", "/anteproyecto", "/asistente"] as const;

export type NavItem = {
  path: string; // locale-agnostic base path (analytics destination)
  href: string; // locale-aware href
  label: string;
  active: boolean;
};

const item = (path: string, base: string, lang: Lang, long = false): NavItem => {
  const r = ROUTES.find((x) => x.path === path)!;
  return { path, href: localePath(path, lang), label: long ? rLabel(r, lang) : rShort(r, lang), active: base === path };
};

/** Header items: the primary routes only. The logo is the home link. */
export function mastheadItems(base: string, lang: Lang): NavItem[] {
  return PRIMARY_PATHS.map((p) => item(p, base, lang));
}

/** Every other non-home route, in site-map order (footer + mobile menu). */
export function secondaryItems(base: string, lang: Lang): NavItem[] {
  return ROUTES.filter((r) => r.path !== "/" && !(PRIMARY_PATHS as readonly string[]).includes(r.path)).map((r) =>
    item(r.path, base, lang, true),
  );
}
