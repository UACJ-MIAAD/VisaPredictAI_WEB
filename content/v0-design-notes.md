# v0 design concept — "Datos históricos"

Generated with v0-sdk · model v0-max (requested v0-1.5-lg is retired; API accepts v0-auto|v0-mini|v0-pro|v0-max|v0-max-fast).
Integrated manually into components/sections/historico.tsx (not blind-pasted).

Chat: https://v0.app/chat/vSChFXajgVm

```
## Visa Bulletin · Datos históricos — Structural Concept

### 1. Theming layer (semantic CSS variables)

Define both themes once; every component consumes tokens, never raw colors.

```css
/* globals.css */
:root {
  --color-bg: #faf9f6;        /* warm paper */
  --color-surface: #ffffff;
  --color-ink: #1a1a1a;       /* near-black headline */
  --color-ink-muted: #5c5c57;
  --color-border: #e5e3dc;    /* hairline */
  --color-accent: #8a1c1c;    /* restrained editorial red */
  --color-accent-2: #1f4e5f;  /* slate teal for comparisons */
  --radius: 2px;
}
.dark {
  --color-bg: #121211;
  --color-surface: #1a1a18;
  --color-ink: #f2f0ea;
  --color-ink-muted: #a3a099;
  --color-border: #2c2c29;
  --color-accent: #d96b6b;
  --color-accent-2: #6fb3c4;
}
```

Map them in Tailwind v4 `@theme inline` so `bg-surface`, `text-ink`, `border-border`, `text-accent` all work:

```css
@theme inline {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-ink: var(--color-ink);
  --color-accent: var(--color-accent);
  --font-serif: 'Playfair Display', serif;
  --font-sans: 'DM Sans', sans-serif;
}
```

### 2. Component hierarchy

```
<VisaBulletinSection>            // <section>, max-w-[1200px] mx-auto px-6
├─ <SectionMasthead>            // kicker + serif H1 + standfirst
├─ <FilterBar>                  // sticky, shared state via context/store
│   ├─ <Select> país
│   ├─ <Select> categoría
│   └─ <Select> tabla (Final Action / Dates for Filing)
├─ <ChartGrid>                  // grid layout, hairline dividers
│   ├─ <PriorityDateTimeline>   // primary — full width, col-span-12
│   ├─ <CountryComparison>      // col-span-7
│   ├─ <StatusDonut>            // col-span-5  (C / F / U)
│   └─ <MonthlyMovementBars>    // col-span-12
└─ <DataTablePanel>
    ├─ <TableToolbar>           // sort hint + <ExportCsvButton>
    └─ <VirtualizedTable>       // @tanstack/react-virtual + react-table
```

### 3. Layout & spacing rhythm

- **Container:** `max-w-[1200px] mx-auto px-6 md:px-8` — generous gutters.
- **Vertical rhythm:** sections separated by `py-16` and a `border-t border-border` hairline, not boxes/shadows.
- **Chart grid:** `grid grid-cols-1 lg:grid-cols-12 gap-px bg-border` (the `gap-px` + border bg creates true 1px hairline dividers between cards, each card `bg-surface p-6`).
- **Filter bar:** `sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-border py-3` with `flex flex-wrap items-end gap-6`.
- **No shadows, no heavy radii** — `rounded-[--radius]` (2px) keeps it editorial.

### 4. Typography

```tsx
<p className="font-sans text-xs uppercase tracking-[0.18em] text-accent">Visa Bulletin</p>
<h1 className="font-serif text-4xl md:text-5xl leading-[1.05] text-ink text-balance">
  Datos históricos
</h1>
<p className="font-sans text-base leading-relaxed text-ink-muted max-w-prose text-pretty">
  Movimiento de fechas de prioridad a lo largo del tiempo. {/* placeholder standfirst */}
</p>
```

Charts label everything in serif headers + sans body; axis ticks `text-xs text-ink-muted`.

### 5. Shared filter state

A single `FilterContext` (`{ pais, categoria, tabla }`) drives all five charts + table, so the filter bar is the one source of truth — no prop drilling, all visualizations recompute from the same selectors.

### 6. Charts (shadcn/ui + Recharts)

Each wrapped in `<ChartContainer>` with a `ChartConfig` mapping series → `var(--color-accent)` / `var(--color-accent-2)`. Donut uses `<PieChart>` with three slices (C / F / U); timeline uses `<LineChart>` with a hairline grid (`stroke="var(--color-border)"`).

### 7. Data table

- `@tanstack/react-table` for sort + column model, `@tanstack/react-virtual` for row virtualization (fixed row height, `overflow-auto max-h-[600px]`).
- Sticky header `bg-surface border-b border-border`, sort indicators as chevron icons.
- **CSV export:** serialize current sorted/filtered rows client-side → `Blob` → download. Header `text-xs uppercase tracking-wider text-ink-muted`.

### Card primitive (reused everywhere)

```tsx
function Panel({ title, children, span = "lg:col-span-12" }: PanelProps) {
  return (
    <section className={`bg-surface p-6 ${span}`}>
      <h2 className="font-serif text-xl text-ink mb-1">{title}</h2>
      <hr className="border-border mb-4" />
      {children}
    </section>
  )
}
```

This keeps the whole section driven by **6 semantic tokens**, a **12-col hairline grid**, and **one shared filter store** — premium, calm, and theme-agnostic.

Want me to scaffold this into actual files (filter context, the five chart components, and the virtualized table) with placeholder data?
```
