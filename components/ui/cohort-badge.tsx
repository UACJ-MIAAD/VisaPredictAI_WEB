"use client";

import * as React from "react";

import { useLang } from "@/components/lang-provider";
import { cohortLabel, cohortOrNull } from "@/lib/data/cohort.mjs";

/**
 * F6 · Insignia de cohorte, OPCIONAL. Mientras el corte publicado no declare la cohorte de una
 * serie —hoy no lo hace— este componente devuelve `null` y la tarjeta queda idéntica a como está.
 * Cuando la declare, se muestra la que dice el metadata gobernado, verbatim: aquí no se inventa
 * ninguna taxonomía ni se deriva de la propia serie.
 */
export function CohortBadge({ meta }: { meta: unknown }) {
  const { lang } = useLang();
  const cohorte = cohortOrNull(meta);
  if (!cohorte) return null;
  const etiqueta = cohortLabel(cohorte, lang);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] leading-none text-[var(--color-muted)]"
      title={etiqueta}
      aria-label={etiqueta}
    >
      {cohorte}
    </span>
  );
}
