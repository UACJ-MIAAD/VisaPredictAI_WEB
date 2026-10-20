"use client";

import * as React from "react";

import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { sourceCalendar, type SourceView } from "@/lib/source-status";
export { loadSourceState } from "@/lib/source-status";

// Frozen record included in the verified cut; never a live source-health check.
export type Vista = SourceView;

const TONO: Record<string, string> = {
  loading: "border-border bg-card",
  ok: "border-border bg-card",
  blocked: "border-amber-500/40 bg-amber-500/5",
  partial: "border-amber-500/40 bg-amber-500/5",
  offline: "border-amber-500/40 bg-amber-500/5",
  invalid: "border-border bg-card",
  absent: "border-border bg-card",
  unavailable: "border-border bg-card",
};

const MENSAJE = { loading: "srcLoading", ok: "srcOk", blocked: "srcBlocked", partial: "srcPartial", offline: "srcOffline", invalid: "srcInvalid", absent: "srcAbsent", unavailable: "srcUnavailable" } as const;

export function SourceBanner({ state }: { state: Vista }) {
  const { lang } = useLang();
  const recorded = "since" in state ? state : null;
  const calendar = recorded ? sourceCalendar(recorded, new Date().toISOString().slice(0, 10)) : null;
  const detalles =
    !recorded || !calendar
      ? []
      : [
          [tr(lang, "srcSince"), recorded.since] as const,
          [tr(lang, "srcPanel"), recorded.panelVintage ?? tr(lang, "srcUnknown")] as const,
          [tr(lang, "srcRecordedExpected"), recorded.expectedMonth] as const,
          [tr(lang, "srcExpected"), calendar.expected] as const,
          ...(calendar.pending.length > 0
            ? ([[tr(lang, "srcMissing"), calendar.pending.join(", ")]] as const)
            : []),
        ];
  return (
    <div data-testid="source-status" data-source-kind={state.kind} role="status" aria-live="polite" className={`mb-6 rounded-xl border p-4 ${TONO[state.kind]}`}>
      <p className="text-sm font-medium">{tr(lang, "srcHeading")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr(lang, MENSAJE[state.kind])}</p>
      {recorded ? <p className="mt-1 text-xs text-muted-foreground">{tr(lang, "srcFrozen")}</p> : null}
      {calendar?.stale ? <p className="mt-2 text-sm font-medium" data-testid="source-stale">{tr(lang, "srcStale")}</p> : null}
      {detalles.length > 0 ? (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {detalles.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex flex-wrap gap-x-1">
              <dt className="font-medium">{etiqueta}:</dt>
              <dd>{valor.split(", ").map((part, index) => <React.Fragment key={part}>{index > 0 ? ", " : ""}<span className="whitespace-nowrap">{part}</span></React.Fragment>)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {recorded?.reason ? (
        <p className="mt-2 break-words text-xs text-muted-foreground">{recorded.reason}</p>
      ) : null}
    </div>
  );
}
