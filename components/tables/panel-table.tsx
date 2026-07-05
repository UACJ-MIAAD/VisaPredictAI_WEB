"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Download, SlidersHorizontal } from "lucide-react";
import { type VisaPanelRow, blockLabel, countryLabel, movementColor } from "@/lib/data/visa-panel";
import { StatusChip } from "@/components/ui/data-cells";
import { tr } from "@/lib/i18n";
import type { Lang } from "@/lib/site-map";
import { track } from "@/lib/analytics";

const makeColumns = (lang: Lang): ColumnDef<VisaPanelRow>[] => [
  { accessorKey: "country", header: tr(lang, "thPais"), cell: (c) => countryLabel(c.getValue<string>(), lang) },
  { accessorKey: "block", header: tr(lang, "thBloque"), cell: (c) => blockLabel(c.getValue<string>(), lang) },
  { accessorKey: "category", header: tr(lang, "thCategoria") },
  { accessorKey: "table", header: tr(lang, "thTabla") },
  { accessorKey: "bulletinMonth", header: tr(lang, "thMes") },
  { accessorKey: "status", header: tr(lang, "thEstado"), cell: (c) => <StatusChip s={c.getValue<string>()} /> },
  { accessorKey: "priorityDate", header: tr(lang, "thFecha"), cell: (c) => c.getValue<string | null>() ?? "—" },
  {
    accessorKey: "daysSinceBase",
    header: tr(lang, "thDias"),
    cell: (c) => {
      const v = c.getValue<number | null>();
      return <span className="tabular-nums">{v ?? "—"}</span>;
    },
  },
  {
    accessorKey: "movement",
    header: tr(lang, "thMov"),
    cell: (c) => {
      const v = c.getValue<number | null>();
      if (v == null) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="tabular-nums" style={{ color: movementColor(v) }}>
          {v > 0 ? `+${v}` : v}
        </span>
      );
    },
  },
];

const colLabel = (lang: Lang, id: string) =>
  ({
    country: tr(lang, "thPais"), block: tr(lang, "thBloque"), category: tr(lang, "thCategoria"),
    table: tr(lang, "thTabla"), bulletinMonth: tr(lang, "thMes"), status: tr(lang, "thEstado"),
    priorityDate: tr(lang, "thFecha"), daysSinceBase: tr(lang, "thDias"), movement: tr(lang, "thMov"),
  })[id] ?? id;

function exportCsv(rows: VisaPanelRow[]) {
  const head = "country,block,category,table,bulletin_month,status,priority_date,days_since_base,movement";
  const body = rows
    .map((r) =>
      [r.country, r.block, r.category, r.table, r.bulletinMonth, r.status,
       r.priorityDate ?? "", r.daysSinceBase ?? "", r.movement ?? ""].join(","),
    )
    .join("\n");
  // ﻿ BOM so Excel reads UTF-8 (accented labels) correctly
  const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "visa_panel.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PanelTable({ rows, lang }: { rows: VisaPanelRow[]; lang: Lang }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const columns = React.useMemo(() => makeColumns(lang), [lang]);
  const colMenuRef = React.useRef<HTMLDetailsElement>(null);

  // AX3c: on small screens start with the secondary columns hidden — the
  // "Columns" menu re-enables them. Computed client-side after mount (SSR
  // renders all columns; setting it in an effect avoids hydration mismatch)
  // and only once, so it never fights the user's own choices.
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      setColumnVisibility({ block: false, table: false, daysSinceBase: false });
    }
  }, []);

  // close the column dropdown on Escape / outside-click
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        colMenuRef.current.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && colMenuRef.current) colMenuRef.current.open = false;
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows: tableRows } = table.getRowModel();
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length
    ? virtualizer.getTotalSize() - items[items.length - 1].end
    : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {tableRows.length.toLocaleString(lang === "en" ? "en-US" : "es-MX")} {tr(lang, "rows")}
        </p>
        <div className="flex items-center gap-2">
          <details ref={colMenuRef} className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> {tr(lang, "columns")}
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-card p-2 shadow-lg">
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {colLabel(lang, col.id)}
                </label>
              ))}
            </div>
          </details>
          <button
            type="button"
            onClick={() => {
              track("CSV Export", {
                rows: rows.length >= 10000 ? "10k+" : rows.length >= 1000 ? "1k-10k" : "<1k",
              });
              exportCsv(rows);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </button>
        </div>
      </div>

      {/* AX3a: never taller than 65dvh on small screens; AX3b: .scroll-x-shadow
          (content.css) paints edge scrims that hint at horizontal overflow */}
      <div
        ref={parentRef}
        className="scroll-x-shadow h-[min(560px,65dvh)] overflow-auto rounded-xl border border-border"
        tabIndex={0}
        aria-label={tr(lang, "tableScroll")}
      >
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[var(--color-accent)]"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && (
              <tr><td style={{ height: padTop }} colSpan={columns.length} /></tr>
            )}
            {items.map((vi) => {
              const row = tableRows[vi.index];
              return (
                <tr key={row.id} className="border-t border-border hover:bg-secondary/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr><td style={{ height: padBottom }} colSpan={columns.length} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
