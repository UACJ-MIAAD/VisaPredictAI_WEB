// Measured intrinsic PNG dimensions for the annotated galleries, probed from
// the files actually shipped (fresh fetch or committed fallback) by
// scripts/fetch-data.mjs — it reads each PNG's IHDR header and emits
// public/data/fig_dims.json at build time. The galleries import that map so
// every language × theme variant renders with its own MEASURED size (audit:
// the old dims() light===dark collapse trusted hand-copied constants, which a
// regenerated figure could silently falsify). The constants kept in the
// components are only the fallback for files missing from this map.
import measured from "@/public/data/fig_dims.json";

export type Dim = { w: number; h: number };

const MEASURED = measured as Record<string, Dim | undefined>;

// `rel` is the PNG path under /data/ (e.g. "eda/en/dark/g01_panel.png").
export function figDim(rel: string, fallback: Dim): Dim {
  const m = MEASURED[rel];
  return m && m.w > 0 && m.h > 0 ? m : fallback;
}
