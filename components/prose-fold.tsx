"use client";

// AW5: reading layer for the long academic prose (/anteproyecto, ~4,100
// words). Progressive enhancement over the server-rendered SectionHTML: after
// mount, everything that follows each section's ".section-sub" lead is moved
// into a native <details class="prose-fold"> (styles in content.css), so the
// page reads as a scannable outline — headline + honest lead per chapter, the
// full literal prose one toggle away. Nothing is invented and nothing is
// duplicated: the lead IS the existing .section-sub emitted by the extractor.
//
// Why DOM-move instead of React markup: the academic HTML is injected via
// dangerouslySetInnerHTML (server component, not ours) — React never diffs
// inside that subtree, so relocating its nodes post-hydration is safe, and a
// re-render only re-sets innerHTML when the html string itself changes (lang
// navigation), after which this effect re-runs and re-wraps.
//
// Defaults: open on desktop (≥1024px, matching the lg breakpoint), folded on
// phones. Without JS nothing is wrapped and the full prose renders.
//
// Deep links: anchors (h3/h4 ids from the extractor) may land inside a closed
// <details>. Browsers do not auto-open <details> for fragment navigation, so
// both on mount and on hashchange we open the fold that contains the target
// and re-scroll to it (scroll-padding-top in globals.css keeps the sticky nav
// clear). Known edge: re-clicking a link whose hash is ALREADY in the URL
// fires no hashchange — acceptable, the fold was opened on first use.

import * as React from "react";

export function ProseFold({
  ids,
  moreLabel,
  lessLabel,
}: {
  /** section element ids to enhance (each must contain a .section-inner) */
  ids: string[];
  moreLabel: string;
  lessLabel: string;
}) {
  React.useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;

    for (const id of ids) {
      const inner = document.querySelector(`#${id} .section-inner`);
      // idempotence: strict-mode double effects / re-runs must not re-wrap
      if (!inner || inner.querySelector(":scope > details.prose-fold")) continue;
      const lead =
        inner.querySelector(":scope > .section-sub") ??
        inner.querySelector(":scope > .section-title");
      if (!lead) continue;

      const rest: Element[] = [];
      for (let el = lead.nextElementSibling; el; el = el.nextElementSibling) {
        rest.push(el);
      }
      if (rest.length === 0) continue;

      const details = document.createElement("details");
      details.className = "prose-fold";
      details.open = desktop;

      const summary = document.createElement("summary");
      const more = document.createElement("span");
      more.className = "pf-more";
      more.textContent = moreLabel;
      const less = document.createElement("span");
      less.className = "pf-less";
      less.textContent = lessLabel;
      summary.append(more, less);

      details.append(summary, ...rest); // append MOVES the existing nodes
      inner.append(details);
    }

    const openForHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch {
        return;
      }
      const fold = target?.closest("details.prose-fold");
      if (fold instanceof HTMLDetailsElement && !fold.open) {
        fold.open = true;
        target?.scrollIntoView();
      }
    };
    openForHash();
    window.addEventListener("hashchange", openForHash);
    return () => window.removeEventListener("hashchange", openForHash);
  }, [ids, moreLabel, lessLabel]);

  return null;
}
