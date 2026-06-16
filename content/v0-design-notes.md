# v0 editorial redesign direction

v0-sdk · model v0-max · chat: https://v0.app/chat/liO19ICux3J
Integrated manually into app/content.css + globals.css.

```
Here's the art direction. The core move: **kill the cards, let typography and whitespace do the grouping.** Boxes are a crutch for when hierarchy fails — fix the hierarchy and you don't need them.

---

## 1) Grouping content without boxes

Replace `border + rounded + shadow + padding` with three tools:

- **Hairline rules** (`1px`, low-contrast) to separate, not enclose. A rule above a section label is worth more than four borders around a card.
- **Whitespace as the primary divider.** Section breaks get `~6–8rem` of vertical space. Related items get `~1.5–2rem`. The eye groups by proximity — Gestalt does the work a border was doing.
- **Typographic hierarchy**: a tracked uppercase sans **kicker**, a Playfair **section head**, then body. That stack reads as "a group" with zero chrome.

```
SECCIÓN 03 · METODOLOGÍA          ← kicker: DM Sans, 0.75rem, uppercase, tracked, muted/accent
Predicción del Boletín de Visas   ← h2: Playfair
[lead paragraph]                  ← larger, muted
[body]
```

**Editorial devices to deploy:**
- **Lead paragraph** — first graf after a heading, larger and lighter (see scale). No "card," just scale contrast.
- **Drop cap** — only on the article opener and major section openers. Playfair, floats 3 lines.
- **Pull quotes** — break the measure, set in Playfair italic, flanked by space not a box. Optional thin accent rule on the left.
- **Marginalia** — footnotes, source notes, bilingual glosses live in the left/right margin column on wide viewports (sans, caption size, muted).

**When a card IS justified** (the only times):
- An **interactive control panel** for the data explorer (filters/toggles) — it's UI, not content, so it may read as a surface.
- A **callout/aside** that is genuinely parenthetical (a "how we modeled this" box). Use a tinted background (`--surface`) with **no border and no shadow** — differentiate by background, not outline.
- **Never** wrap prose, stats, headings, or charts in a card.

---

## 2) Type system

Playfair Display (display/quotes) + DM Sans (everything else). Body is sans — this matches The Pudding and keeps long bilingual text legible. Measure is king: **65–72ch**.

| Token | Family | Size (desktop) | Weight | Leading | Tracking |
|---|---|---|---|---|---|
| `h1` display | Playfair | `clamp(2.75rem, 6vw, 4.75rem)` | 600 | 1.04 | `-0.02em` |
| `h2` | Playfair | `clamp(1.875rem, 3.5vw, 2.875rem)` | 600 | 1.1 | `-0.015em` |
| `h3` | Playfair | `clamp(1.375rem, 2vw, 1.625rem)` | 600 | 1.2 | `-0.01em` |
| `kicker` | DM Sans | `0.75rem` (12px) | 600 | 1.3 | `0.12em` UPPER |
| `lead` | DM Sans | `clamp(1.1875rem, 1.6vw, 1.375rem)` | 400 | 1.5 | `0` |
| `body` | DM Sans | `1.1875rem` (19px) | 400 | 1.65 | `0` |
| `caption` | DM Sans | `0.8125rem` (13px) | 500 | 1.45 | `0.01em` |
| `pull-quote` | Playfair *italic* | `clamp(1.5rem, 3vw, 2.25rem)` | 500 | 1.25 | `-0.01em` |
| `stat-number` | Playfair | `clamp(2.5rem, 5vw, 4rem)` | 600 | 1 | `-0.02em`, `tabular-nums` |

Rules: body `max-width: 68ch`. Never let Playfair go below ~20px (it gets spindly). Use `text-pretty` on body, `text-balance` on headings. Always set `font-feature-settings` for tabular numerals on data.

---

## 3) Color + accent system (CSS variables, light/dark)

Vivid blue `#0a4da8` + ochre, used like ink accents — links, rules, drop caps, one chart series, the pull-quote mark. **Everything else is warm paper + near-black.** Never tint backgrounds with the accent.

```css
:root {
  /* light — warm paper */
  --background:        #fcfbf8;
  --surface:          #f4f2ec;   /* the only "card" fill */
  --foreground:        #1b1a17;
  --muted-foreground:  #6f6c64;
  --rule:             #e4e1d8;   /* hairlines */
  --accent:           #0a4da8;   /* blue */
  --accent-contrast:  #ffffff;
  --ochre:            #b9791a;
  --selection:        #0a4da81a;
}

.dark {
  --background:        #14151a;
  --surface:          #1d1f26;
  --foreground:        #ece9e2;
  --muted-foreground:  #9a978d;
  --rule:             #2b2d34;
  --accent:           #6aa6f0;   /* lift blue for AA on dark */
  --accent-contrast:  #0a0b0e;
  --ochre:            #d99a3c;   /* lift ochre too */
  --selection:        #6aa6f026;
}
```

Tailwind v4 wiring (`globals.css`):

```css
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-foreground: var(--foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-rule: var(--rule);
  --color-accent: var(--accent);
  --color-ochre: var(--ochre);
  --font-serif: "Playfair Display", Georgia, serif;
  --font-sans: "DM Sans", system-ui, sans-serif;
}
```

Discipline: **accent appears at most ~3 times per viewport.** Links get accent text + `1px` accent underline offset `0.15em`. Ochre is reserved for the secondary data series and the occasional kicker — not decoration.

---

## 4) Layout

**Named-column grid** so content flows in a measure but media/charts can break out:

```css
.article {
  display: grid;
  grid-template-columns:
    [full-start] minmax(1.25rem, 1fr)
    [wide-start] minmax(0, 9rem)
    [text-start] min(68ch, 100% - 2.5rem) [text-end]
    minmax(0, 9rem) [wide-end]
    minmax(1.25rem, 1fr) [full-end];
}
.article > *           { grid-column: text-start / text-end; }   /* prose */
.article > .wide       { grid-column: wide-start / wide-end; }   /* charts */
.article > .full       { grid-column: full-start / full-end; }   /* hero media */
.article > .margin-note{ grid-column: text-end / wide-end; }     /* marginalia */
```

**Section rhythm** — 8px baseline, spacing scale: `0.5 / 1 / 1.5 / 2 / 3 / 4 / 6 / 8rem`. Section to section: `clamp(4rem, 8vw, 8rem)`. Heading to its body: `1.5rem`. Paragraph spacing: `1.25rem` (or first-line indent + zero spacing — pick one, don't do both).

**Rule as separator:**
```css
.rule { border: 0; border-top: 1px solid var(--rule); margin: 4rem 0; }
```

**"By the numbers" — editorial, not widgets.** A row of figures divided by vertical hairlines, no boxes:

```html
<dl class="stats">
  <div><dt>Casos modelados</dt><dd>128,400</dd></div>
  <div><dt>Precisión (F1)</dt><dd>0.91</dd></div>
  <div><dt>Meses adelantados</dt><dd>3</dd></div>
</dl>
```
```css
.stats { display: grid; grid-auto-flow: column; gap: 0;
         border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.stats > div { padding: 1.5rem 2rem; border-left: 1px solid var(--rule); }
.stats > div:first-child { border-left: 0; }
.stats dd { font-family: var(--font-serif); font-size: clamp(2.5rem,5vw,4rem);
            font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
.stats dt { font-family: var(--font-sans); font-size: 0.75rem; text-transform: uppercase;
            letter-spacing: 0.12em; color: var(--muted-foreground); margin-bottom: 0.5rem; }
```

**Charts that feel like NYT graphics** (applies whether Recharts/SVG):
- No chart border, no enclosing box, no drop shadow, no rounded container.
- **Horizontal gridlines only**, `1px`, `--rule` color; drop vertical gridlines and the y-axis line.
- **Direct labeling** at the end of each line instead of a legend. Label sits in the series color.
- Axis ticks: DM Sans `0.75rem`, `--muted-foreground`, sparse (≤5 y-ticks).
- Series colors: `--accent` (primary), `--ochre` (secondary), `--muted-foreground` (context/baseline). Max 3 series before you facet.
- Add a Playfair **chart title** + sans **subtitle/dek** + caption **source line** — that editorial frame is what sells "graphic" over "widget."
- Annotation layer: thin accent leader line + caption text pointing at the key moment (e.g. a retrogression). This is the single most "NYT" move.

```jsx
// Recharts: strip the chrome
<CartesianGrid stroke="var(--rule)" vertical={false} />
<XAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
<YAxis axisLine={false} tickLine={false} width={32} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
<Line dataKey="eb2_india" stroke="var(--accent)" strokeWidth={2} dot={false} />
```

**Drop cap & pull quote:**
```css
.lead::first-letter { /* opener only */
  font-family: var(--font-serif); font-weight: 600; float: left;
  font-size: 3.6em; line-height: 0.78; padding: 0.05em 0.08em 0 0; color: var(--accent);
}
.pull-quote {
  font-family: var(--font-serif); font-style: italic; font-weight: 500;
  font-size: clamp(1.5rem, 3vw, 2.25rem); line-height: 1.25;
  padding-left: 1.25rem; border-left: 2px solid var(--accent); margin: 3rem 0;
}
```

---

## 5) Mobile-first specifics

- Body `17px`, leading `1.6`; the grid collapses to a single column with `1.25rem` side padding (`min(68ch, 100% - 2.5rem)` already handles this).
- `h1`/`h2`/stat clamps already bottom out at mobile sizes — no separate breakpoints needed for type.
- **Marginalia** drops inline *below* the paragraph it annotates, in caption style with a top hairline (`.margin-note { grid-column: text; }` at base, repositioned at `md:`).
- **Stats stack vertically**: sw
```
