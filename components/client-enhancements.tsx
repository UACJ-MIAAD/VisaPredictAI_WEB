"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Re-implements the original site's progressive enhancements against the
 * preserved markup: reveal-on-scroll, glossary live search, reference range
 * tabs. Re-wires on every route change. Respects prefers-reduced-motion.
 */
export function ClientEnhancements() {
  const pathname = usePathname();
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // ── Reveal on scroll
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    let obs: IntersectionObserver | undefined;
    if (reduceMotion) {
      revealEls.forEach((el) => el.classList.add("visible"));
    } else {
      obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("visible");
              obs!.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );
      revealEls.forEach((el) => obs!.observe(el));
    }

    // ── Glossary live search
    const search = document.getElementById("glossSearch") as HTMLInputElement | null;
    const empty = document.getElementById("glossEmpty");
    const onSearch = () => {
      if (!search) return;
      const q = search.value.trim().toLowerCase();
      let n = 0;
      document.querySelectorAll<HTMLElement>(".gloss-item").forEach((it) => {
        const k = it.dataset.k || "";
        const txt = it.textContent?.toLowerCase() || "";
        const match = q === "" || k.includes(q) || txt.includes(q);
        it.classList.toggle("hidden", !match);
        if (match) n++;
      });
      if (empty) empty.style.display = n === 0 ? "block" : "none";
    };
    search?.addEventListener("input", onSearch);

    // ── Reference range tabs
    const tabs = Array.from(document.querySelectorAll<HTMLElement>(".ref-tab"));
    const onTab = (tab: HTMLElement) => () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const range = tab.dataset.range;
      document.querySelectorAll<HTMLElement>(".ref-item").forEach((item) => {
        if (range === "all") {
          item.classList.remove("hidden");
          return;
        }
        const [lo, hi] = (range || "").split("-").map(Number);
        const num = parseInt(item.dataset.n || "0", 10);
        item.classList.toggle("hidden", !(num >= lo && num <= hi));
      });
    };
    const handlers = tabs.map((tab) => {
      const h = onTab(tab);
      tab.addEventListener("click", h);
      return h;
    });

    return () => {
      obs?.disconnect();
      search?.removeEventListener("input", onSearch);
      tabs.forEach((tab, i) => tab.removeEventListener("click", handlers[i]));
    };
  }, [pathname]);

  return null;
}
