"use client";

// Deep links on pages with async-loading sections land short: the browser's
// native anchor scroll fires before bulletins/charts above expand the layout,
// stranding the user thousands of px above the target (post-plan audit,
// reproduced in prod). This re-anchors to the hash a few times while the
// layout settles — and backs off the moment the user interacts.
import * as React from "react";
import { usePathname } from "next/navigation";

const SETTLE_PASSES_MS = [250, 700, 1600, 3200];

export function HashRescroll() {
  // Re-arm on client-side navigation too (the shell persists across <Link>
  // navigations, so a mount-only effect would cover full loads only).
  const pathname = usePathname();
  React.useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    // Any intentional user interaction wins over our correction: wheel/touch,
    // keyboard, MOUSE (rail clicks, scrollbar drags) and in-page hash changes
    // (audit round 2 — pointer navigation used to get yanked back).
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    window.addEventListener("pointerdown", cancel);
    window.addEventListener("hashchange", cancel);
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
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("hashchange", cancel);
    };
  }, [pathname]);
  return null;
}
