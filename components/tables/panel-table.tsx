"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Download, SlidersHorizontal } from "lucide-react";
import {
  type VisaPanelRow,
  countryLabel,
} from "@/lib/data/visa-panel";

function StatusChip({ s }: { s: string }) {
  const color =
    s === "F" ? "var(--color-success)"
    : s === "U" ? "var(--color-danger)"
    : s === "C" ? "var(--color-accent)"
    : "var(--color-muted)";
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[0.7rem] font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {s}
    </span>
  );
}

const columns: ColumnDef<VisaPanelRow>[] = [
  { accessorKey: "country", header: "País / área", cell: (c) => countryLabel(c.getValue<string>()) },
  { accessorKey: "block", header: "Bloque" },
  { accessorKey: "category", header: "Categoría" },
  { accessorKey: "table", header: "Tabla" },
  { accessorKey: "bulletinMonth", header: "Mes" },
  {
    accessorKey: "status",
    header: "Estado",
    cell: (c) => <StatusChip s={c.getValue<string>()} />,
  },
  {
    accessorKey: "priorityDate",
    header: "Fecha prioridad",
    cell: (c) => c.getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "daysSinceBase",
    header: "Días-base",
    cell: (c) => {
      const v = c.getValue<number | null>();
      return <span className="tabular-nums">{v ?? "—"}</span>;
    },
  },
  {
    accessorKey: "movement",
    header: "Movimiento",
    cell: (c) => {
      const v = c.getValue<number | null>();
      if (v == null) return <span className="text-muted-foreground">—</span>;
      const color = v > 0 ? "var(--color-success)" : v < 0 ? "var(--color-danger)" : "var(--color-muted)";
      return (
        <span className="tabular-nums" style={{ color }}>
          {v > 0 ? `+${v}` : v}
        </span>
      );
    },
  },
];

const COL_LABEL: Record<string, string> = {
  country: "País", block: "Bloque", category: "Categoría", table: "Tabla",
  bulletinMonth: "Mes", status: "Estado", priorityDate: "Fecha prioridad",
  daysSinceBase: "Días-base", movement: "Movimiento",
};

function exportCsv(rows: VisaPanelRow[]) {
  const head = "country,block,category,table,bulletin_month,status,priority_date,days_since_base,movement";
  const body = rows
    .map((r) =>
      [r.country, r.block, r.category, r.table, r.bulletinMonth, r.status,
       r.priorityDate ?? "", r.daysSinceBase ?? "", r.movement ?? ""].join(","),
    )
    .join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "visa_panel_filtrado.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PanelTable({ rows }: { rows: VisaPanelRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
          {tableRows.length.toLocaleString("es-MX")} filas
        </p>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Columnas
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-card p-2 shadow-lg">
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {COL_LABEL[col.id] ?? col.id}
                </label>
              ))}
            </div>
          </details>
          <button
            type="button"
            onClick={() => exportCsv(rows)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </button>
        </div>
      </div>

      <div
        ref={parentRef}
        className="h-[560px] overflow-auto rounded-xl border border-border"
        tabIndex={0}
        aria-label="Tabla histórica del panel, desplazable"
      >
        <table className="w-full min-w-[760px] border-collapse text-sm">
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
