"use client";

// Deep links on pages with async-loading sections land short: the browser's
// native anchor scroll fires before bulletins/charts above expand the layout,
// stranding the user thousands of px above the target (post-plan audit,
// reproduced in prod). This re-anchors to the hash a few times while the
// layout settles — and backs off the moment the user scrolls on their own.
import * as React from "react";

const SETTLE_PASSES_MS = [250, 700, 1600, 3200];

export function HashRescroll() {
  React.useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    // Any intentional user scroll wins over our correction.
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    const timers = SETTLE_PASSES_MS.map((ms) =>
      window.setTimeout(() => {
        if (cancelled) return;
        document.getElementById(id)?.scrollIntoView();
      }, ms),
    );
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);
  return null;
}
