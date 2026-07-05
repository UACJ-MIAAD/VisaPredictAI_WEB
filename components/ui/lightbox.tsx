"use client";

// AX8: native <dialog> lightbox for the gallery figures. Replaces the old
// target=_blank jump to the raw PNG: the image opens in-page (pinch-zoomable
// on touch), Escape and backdrop-click close it, and the original href stays
// available inside the dialog ("Open original") as the full-size fallback.
// The native modal dialog gives focus containment and top-layer stacking for
// free; all colors are semantic tokens.

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { Dim } from "@/lib/data/fig-dims";

export function Lightbox({
  open,
  onClose,
  src,
  dim,
  alt,
  originalLabel,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  dim: Dim;
  alt: string;
  originalLabel: string;
  closeLabel: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // clicks on the ::backdrop (and the dialog's own padding) hit the
        // <dialog> element itself — content clicks hit its children
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto max-h-[95dvh] w-auto max-w-[min(95vw,1400px)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[var(--color-ink)] backdrop:bg-black/70 sm:p-4"
    >
      {/* only mount the (large) image while open, so it is never fetched early */}
      {open && (
        <Image
          src={src}
          alt={alt}
          width={dim.w}
          height={dim.h}
          className="mx-auto h-auto max-h-[85dvh] w-auto max-w-full [touch-action:pinch-zoom]"
        />
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <a
          href={src}
          target="_blank"
          rel="noopener"
          className="text-xs text-[var(--color-muted)] underline underline-offset-2 transition-colors hover:text-[var(--color-accent)]"
        >
          {originalLabel} ↗
        </a>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => ref.current?.close()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </dialog>
  );
}
