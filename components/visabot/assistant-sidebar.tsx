"use client";

// Sidebar blocks of the /asistente console, extracted from assistant-console
// (US J2) so the SAME content can be laid out three ways without duplicating
// DOM (a single instance of every control exists at any time, so role/text
// queries stay unambiguous for the e2e suite):
//   • sections="all"      → mobile/tablet drawer + laptop left rail
//   • sections="controls" → ultra-wide (≥1920px) left rail: context + tools
//   • sections="insights" → ultra-wide right rail: KPIs + quick questions
// Pure presentation: all state and the tool/chat pipelines stay in
// assistant-console (no data/chat logic lives here).
import * as React from "react";
import {
  BookOpen, CalendarDays, ArrowLeftRight, type LucideIcon,
} from "lucide-react";
import { tr } from "@/lib/i18n";
import { countryLabel, type Panel } from "@/lib/data/visa-panel";
import { monthLabel, type Kpi } from "@/lib/visabot/analytics";
import type { Lang } from "./types";

export type ToolKind =
  | "evol" | "compare" | "move" | "status" | "race"
  | "heat" | "radar" | "table" | "forecast" | "diff";
export type ToolDef = { k: ToolKind; icon: LucideIcon; label: string };

function Select({ label, value, onChange, options, fmt }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; fmt?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col text-[0.7rem] text-[var(--color-muted)]">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-lg border border-border bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-ink)]">
        {options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : o}</option>)}
      </select>
    </label>
  );
}

export function AssistantSidebar({
  lang,
  sections = "all",
  panel,
  panelErr,
  kpis,
  months,
  suggestions,
  tools,
  runTool,
  onAsk,
  country, setCountry,
  category, setCategory,
  table, setTable,
  month, setMonth,
  monthB, setMonthB,
}: {
  lang: Lang;
  sections?: "all" | "controls" | "insights";
  panel: Panel | null;
  panelErr: boolean;
  kpis: Kpi[];
  months: string[];
  suggestions: string[];
  tools: ToolDef[];
  runTool: (kind: ToolKind) => void;
  onAsk: (q: string) => void;
  country: string; setCountry: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  table: string; setTable: (v: string) => void;
  month: string; setMonth: (v: string) => void;
  monthB: string; setMonthB: (v: string) => void;
}) {
  const showControls = sections !== "insights";
  const showInsights = sections !== "controls";
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto overscroll-contain p-4">
      {showInsights && (
        <div>
          <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acPanorama")}</h3>
          {/* !gap-px/!mt-0 beat content.css's global `.grid { gap:2rem 2.4rem;
              margin-top:1.5rem }` (unlayered, so it outranks Tailwind's layered
              utilities — same trick as descargas.tsx). Without them the KPI
              hairline grid renders fat gray bands. */}
          <div className="grid grid-cols-2 !mt-0 !gap-px overflow-hidden rounded-xl border border-border bg-border">
            {(panel ? kpis : Array.from({ length: 6 }, () => null)).map((k, i) => (
              <div key={i} className="bg-[var(--color-surface)] px-3 py-2.5" title={k?.hint}>
                <div className="font-serif text-base font-bold leading-tight text-[var(--color-ink)]">{k ? k.value : "—"}</div>
                <div className="mt-0.5 text-[0.6rem] leading-tight text-[var(--color-muted)]">{k ? k.label : "…"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showControls && (
        <div>
          <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acContext")}</h3>
          <div className="grid grid-cols-1 !mt-0 !gap-2">
            <Select label={tr(lang, "acSelCountry")} value={country} onChange={setCountry} options={panel?.countries ?? [country]} fmt={countryLabel} />
            <Select label={tr(lang, "acSelCategory")} value={category} onChange={setCategory} options={panel?.categories ?? [category]} />
            <Select label={tr(lang, "acSelTable")} value={table} onChange={setTable} options={panel?.tables ?? [table]} />
            <Select label={tr(lang, "acSelMonth")} value={month} onChange={setMonth} options={months.length ? months : [month]} fmt={(m) => (m ? monthLabel(m, lang) : "—")} />
            <button onClick={() => runTool("table")} disabled={!panel} className="mt-0.5 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent-btn)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden /> {tr(lang, "acViewTable")}
            </button>
            <Select label={tr(lang, "acSelMonthB")} value={monthB} onChange={setMonthB} options={months.length ? months : [monthB]} fmt={(m) => (m ? monthLabel(m, lang) : "—")} />
            <button onClick={() => runTool("diff")} disabled={!panel} className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] disabled:opacity-50">
              <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden /> {tr(lang, "acCompareBulletins")}
            </button>
          </div>
        </div>
      )}
      {showControls && (
        <div>
          <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acTools")}</h3>
          <div className="grid grid-cols-1 !mt-0 !gap-2">
            {tools.map((t) => (
              <button key={t.k} onClick={() => runTool(t.k)} disabled={!panel} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2 text-left text-xs text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:opacity-50">
                <t.icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
          {panelErr && <p className="mt-2 text-[0.7rem] text-[var(--color-danger)]">{tr(lang, "acDataError")}</p>}
        </div>
      )}
      {showInsights && suggestions.length > 0 && (
        <div>
          <h3 className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{tr(lang, "acQuick")}</h3>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => onAsk(s)} className="vb-suggest flex items-center gap-2 text-left text-[0.8rem]">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {showInsights && (
        <p className="mt-auto text-[0.6rem] leading-snug text-[var(--color-muted)]">{tr(lang, "vbDisclaimer")}</p>
      )}
    </div>
  );
}
