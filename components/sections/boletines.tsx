"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Same live source the original site used.
const FEED =
  "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main/data/processed/bulletins.json";

type Row = {
  country: string;
  block: string;
  category: string;
  table: string;
  status: "C" | "F" | "U" | string;
  raw_value: string | null;
  delta_days: number | null;
};
type Feed = {
  generated_utc: string;
  latest_month: string;
  available_months: string[];
  months: Record<string, Row[]>;
};

const COUNTRY: Record<string, string> = {
  mexico: "México",
  india: "India",
  china: "China",
  philippines: "Filipinas",
  all_chargeability: "All Charg.",
};
const BLOCK: Record<string, string> = { employment: "Empleo", family: "Familiar" };
const MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const country = (c: string) => COUNTRY[c] || c;
const block = (b: string) => BLOCK[b] || b;
const mLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return `${MES[+mo - 1]} ${y}`;
};

function Movement({ d }: { d: number | null }) {
  if (d === null || d === undefined)
    return <span className="text-muted-foreground">—</span>;
  if (d > 0)
    return <span className="text-[var(--color-success)]">▲ +{d} d</span>;
  if (d < 0)
    return <span className="text-[var(--color-danger)]">▼ {d} d</span>;
  return <span className="text-muted-foreground">= 0</span>;
}

function StatusChip({ s }: { s: string }) {
  const color =
    s === "F"
      ? "var(--color-success)"
      : s === "U"
        ? "var(--color-danger)"
        : "var(--color-accent)";
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 font-mono text-xs font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {s}
    </span>
  );
}

export function Boletines() {
  const [data, setData] = React.useState<Feed | null>(null);
  const [error, setError] = React.useState(false);
  const [month, setMonth] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const ref = React.useRef<HTMLElement | null>(null);
  const loaded = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !loaded.current) {
            loaded.current = true;
            fetch(FEED)
              .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
              })
              .then((d: Feed) => {
                setData(d);
                setMonth(d.latest_month);
              })
              .catch(() => setError(true));
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rows = React.useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    return (data.months[month] || []).filter(
      (r) =>
        !q ||
        `${country(r.country)} ${block(r.block)} ${r.category} ${r.table}`
          .toLowerCase()
          .includes(q),
    );
  }, [data, month, filter]);

  const news = React.useMemo(() => {
    if (!data) return null;
    const r = data.months[data.latest_month] || [];
    return {
      adv: r.filter((x) => (x.delta_days ?? 0) > 0).length,
      ret: r.filter((x) => (x.delta_days ?? 0) < 0).length,
      n: r.length,
    };
  }, [data]);

  return (
    <section id="boletines" ref={ref} className="section">
      <div className="section-inner">
        <span className="section-tag">Datos en vivo · U.S. Visa Bulletin</span>
        <h2 className="section-title">Boletines</h2>
        <p className="section-sub">
          Cada mes el Departamento de Estado de EE.&nbsp;UU. publica un nuevo{" "}
          <em>Visa Bulletin</em>. En cuanto aparece, el pipeline lo congela,
          reconstruye el panel y actualiza este feed automáticamente. Las fechas
          son <strong>datos oficiales publicados</strong> —no predicciones del
          modelo— con el movimiento respecto al mes anterior.
        </p>

        {error ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground">
              No se pudo cargar el feed de boletines en este momento. Intenta
              recargar la página.
            </p>
          </div>
        ) : !data ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-48" />
              <Skeleton className="h-11 w-64" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl border border-border bg-card p-5">
              <span className="inline-block rounded-full bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider text-[var(--color-accent)]">
                Nuevo boletín
              </span>
              <h3 className="mt-2 font-serif text-xl font-bold">
                Boletín de {mLabel(data.latest_month)}
              </h3>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">{news?.adv}</strong>{" "}
                categorías avanzaron ·{" "}
                <strong className="text-foreground">{news?.ret}</strong>{" "}
                retrocedieron respecto al mes anterior.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {news?.n} series · ventana {data.available_months.length} meses ·
                actualizado {data.generated_utc}
              </p>
            </div>

            <div className="mb-4 flex flex-wrap gap-4">
              <label className="text-sm text-muted-foreground">
                Mes del boletín
                <select
                  className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-foreground"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {[...data.available_months].reverse().map((m) => (
                    <option key={m} value={m}>
                      {mLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted-foreground">
                Filtrar
                <input
                  type="text"
                  placeholder="país, categoría… (ej. México, EB2)"
                  className="mt-1 block w-64 max-w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-left">
                    {["País / área", "Bloque", "Categoría", "Tabla", "Estado", "Fecha", "Movimiento"].map(
                      (h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        No hay series que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{country(r.country)}</td>
                        <td className="px-3 py-2">{block(r.block)}</td>
                        <td className="px-3 py-2">{r.category}</td>
                        <td className="px-3 py-2">{r.table}</td>
                        <td className="px-3 py-2"><StatusChip s={r.status} /></td>
                        <td className="px-3 py-2">{r.raw_value || "—"}</td>
                        <td className="px-3 py-2"><Movement d={r.delta_days} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {rows.length} series en {mLabel(month)}
              {filter ? " (filtradas)" : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
