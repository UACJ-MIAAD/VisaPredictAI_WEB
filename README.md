# VisaPredict AI — sitio del proyecto (MIAAD · UACJ)

Sitio editorial estilo *data journalism* del anteproyecto **VisaPredict AI**.
Reconstruido (jun-2026) de un HTML estático único a **Next.js (App Router) +
TypeScript + Tailwind + shadcn/ui**, con tema claro/oscuro, KaTeX, gráficas
Recharts y una tabla histórica virtualizada (TanStack) sobre el panel real
`y_{p,c,b,t}` del *U.S. Visa Bulletin*.

## Stack

- **Next.js 15** (App Router) · **TypeScript** · **Tailwind v4** · **shadcn/ui**
- **next-themes** (claro/oscuro sin FOUC, vía variables CSS semánticas)
- **KaTeX** (matemáticas) · **Recharts** (gráficas) · **TanStack Table + Virtual** (tabla de ~27 k filas)
- **v0-sdk** como motor de diseño (concepto en `content/v0-design-notes.md`)
- **Export estático** (`output: "export"`) → se publica como sitio estático

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000  (corre el extractor de contenido antes)
```

## Build y verificación

```bash
npm run build      # genera contenido + export estático en out/
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

## Diseño e idioma

- **Sistema editorial** (dirección de arte vía v0): sin tarjetas con borde — se
  agrupa con reglas finas, espacio en blanco y jerarquía tipográfica (serif
  Playfair + DM Sans). Tokens semánticos claro/oscuro, azul UACJ vivo usado con
  moderación. `app/content.css` re-tematiza el markup académico preservado.
- **Bilingüe ES/EN**: toggle en el nav (`LangProvider` + `lib/i18n.ts`). El
  *chrome* (nav, hero, explorar, mastheads de ruta, footer, explorador de datos)
  es bilingüe; el texto académico permanece en español (idioma de la tesis) con
  una nota honesta en inglés. `lib/site-map.ts` lleva etiquetas/blurbs en ambos
  idiomas.

## Arquitectura de rutas

El sitio se dividió de un monolito de scroll único a **rutas separadas por
responsabilidad** (App Router). `lib/site-map.ts` es la **fuente única de
verdad**: nav, scroll-spy, menú móvil, footer y composición de páginas derivan
de ahí.

| Ruta | Contenido | First Load JS |
|---|---|---|
| `/` | Hero · Resumen · navegador de partes · Autores · Contacto | ~106 kB |
| `/anteproyecto` | Capítulos I–IV · Tablas · Reproducibilidad | ~106 kB |
| `/ingenieria` | Panel · MLOps · Estructura · Modelo de datos | ~106 kB |
| `/datos-historicos` | Boletines en vivo · explorador interactivo | ~119 kB |
| `/recursos` | Glosario (42) · Referencias IEEE (64) | ~106 kB |

Recharts y TanStack Table se cargan con `next/dynamic` **solo** en
`/datos-historicos`, y aun ahí de forma diferida al montar el explorador
(`components/sections/panel-explorer.tsx`).

## Contenido

La prosa académica (capítulos, glosario de 42 términos, 64 referencias IEEE) se
preserva **literal** desde `content/source.html` y se transforma en build con
`scripts/extract-content.mjs` (quita avisos, renderiza KaTeX) hacia
`lib/content/sections.generated.ts`. Las secciones nuevas (hero, boletines en
vivo, *Datos históricos*) son componentes React.

Datos históricos: `public/data/visa_panel_long.csv` (panel real del repo
`UACJ-MIAAD/VisaPredictAI`). El feed de boletines se consume en vivo desde
`raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI`. No hay datos inventados:
las combinaciones sin fecha muestran un estado «datos no encontrados».

## Despliegue

- **Netlify** (`netlify.toml`): `command = npm run build`, `publish = out`.
- Cualquier hosting estático sirve el directorio `out/`.
