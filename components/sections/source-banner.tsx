"use client";

import * as React from "react";

import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { parseSourceStatus, type SourceState } from "@/lib/source-status";

// F2 · El estado de la fuente sale del feed canónico de ingesta (D3). Mientras el corte
// publicado no lo incluya, la respuesta es 404 y el estado es `absent`: NO se dibuja banner
// alguno, porque inventar un bloqueo es tan falso como prometer una actualización automática.
const FEED = "/data/ingestion_state.json";

export type Vista = SourceState | { kind: "invalid" };

export async function loadSourceState(fetcher: typeof fetch = fetch): Promise<Vista> {
  let cuerpo: string;
  try {
    const r = await fetcher(FEED);
    if (r.status === 404) return { kind: "absent" };
    if (!r.ok) return { kind: "absent" };
    cuerpo = await r.text();
  } catch {
    // Sin red no se sabe nada de la fuente, y no saber no es estar bloqueado.
    return { kind: "absent" };
  }
  try {
    return parseSourceStatus(cuerpo);
  } catch {
    // Presente pero malo: se dice que no se pudo verificar, nunca un diagnóstico inventado.
    return { kind: "invalid" };
  }
}

const TONO: Record<string, string> = {
  ok: "border-border bg-card",
  blocked: "border-amber-500/40 bg-amber-500/5",
  partial: "border-amber-500/40 bg-amber-500/5",
  offline: "border-amber-500/40 bg-amber-500/5",
  invalid: "border-border bg-card",
};

const MENSAJE = { ok: "srcOk", blocked: "srcBlocked", partial: "srcPartial", offline: "srcOffline", invalid: "srcInvalid" } as const;

export function SourceBanner({ state }: { state: Vista }) {
  const { lang } = useLang();
  if (state.kind === "absent") return null;
  const detalles =
    state.kind === "invalid"
      ? []
      : [
          [tr(lang, "srcSince"), state.since] as const,
          [tr(lang, "srcExpected"), state.expectedMonth] as const,
          ...(state.missingMonths.length > 0
            ? ([[tr(lang, "srcMissing"), state.missingMonths.join(", ")]] as const)
            : []),
        ];
  return (
    <div role="status" aria-live="polite" className={`mb-6 rounded-xl border p-4 ${TONO[state.kind]}`}>
      <p className="text-sm font-medium">{tr(lang, "srcHeading")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr(lang, MENSAJE[state.kind])}</p>
      {detalles.length > 0 ? (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {detalles.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex gap-1">
              <dt className="font-medium">{etiqueta}:</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {state.kind !== "invalid" && state.reason ? (
        <p className="mt-2 break-words text-xs text-muted-foreground">{state.reason}</p>
      ) : null}
    </div>
  );
}
