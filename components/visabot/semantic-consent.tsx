"use client";

// AZ1 — consent banner for the ~150 MB semantic engine download. Rendered by
// both chat surfaces just above the input. The bot is fully functional with
// BM25 (lexical) retrieval before — and without — this download; the banner
// disappears once the download has been started (the header pill then shows
// loading/ready state).
import * as React from "react";
import { Sparkles } from "lucide-react";
import { tr } from "@/lib/i18n";
import type { Lang } from "./types";

export function SemanticConsent({
  lang,
  semantic,
  constrained,
  onEnable,
}: {
  lang: Lang;
  semantic: boolean; // download already started/consented
  constrained: boolean; // saveData / 2g connection detected
  onEnable: () => void;
}) {
  if (semantic) return null;
  return (
    <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="min-w-0 flex-1 text-[0.65rem] leading-snug text-[var(--color-muted)]">
        {tr(lang, "vbSemanticHint")}
        {constrained && (
          <>
            {" "}
            <span className="font-medium">{tr(lang, "vbSemanticSlowNet")}</span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onEnable}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--color-accent)] transition hover:border-[var(--color-accent)]"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {tr(lang, "vbSemanticEnable")}
      </button>
    </div>
  );
}
