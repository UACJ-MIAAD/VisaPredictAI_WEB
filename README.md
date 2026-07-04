<p align="center">
  <img src="https://img.shields.io/badge/UACJ-003CA6?style=for-the-badge" alt="UACJ"/>
  <img src="https://img.shields.io/badge/MIAAD-FFD600?style=for-the-badge&logoColor=003CA6&labelColor=003CA6" alt="MIAAD"/>
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Licencia-MIT-003CA6?style=for-the-badge&labelColor=555559" alt="Licencia"/>
</p>

# VisaPredict AI — sitio del proyecto (MIAAD · UACJ)

Sitio editorial estilo *data journalism* del anteproyecto **VisaPredict AI**
(predicción de fechas de prioridad del *U.S. Visa Bulletin*). Reconstruido
(jun-2026) de un HTML estático único a una app **Next.js (App Router) +
TypeScript** bilingüe (ES/EN), con tema claro/oscuro, KaTeX, gráficas Recharts y
una tabla virtualizada sobre el panel real `y_{p,c,b,t}`. **Export estático** →
se publica en Netlify como sitio estático. En vivo: **https://visapredictai.com**

---

## Qué contiene el sitio (diagrama de flujo)

```mermaid
flowchart TD
    subgraph BUILD["🛠️ Build (estático)"]
        SRC["content/source.html (ES)<br/>content/en/*.html (EN)"]
        EXT["scripts/extract-content.mjs<br/>quita avisos · KaTeX · de-box"]
        GEN["lib/content/sections.generated.ts (ES)<br/>sections.en.generated.ts (EN)"]
        SRC --> EXT --> GEN
        OG["app/opengraph-image.tsx<br/>→ tarjeta social 1200×630"]
        SEOF["app/robots.ts · sitemap.ts · manifest.ts<br/>favicon.ico"]
    end

    subgraph APP["⚛️ App Router"]
        RL["app/layout.tsx<br/>fuentes · ThemeProvider · JSON-LD · Plausible"]
        RL --> ES["(es)/layout → SiteShell lang=es"]
        RL --> EN["en/layout → SiteShell lang=en"]
        SHELL["SiteShell<br/>SiteNav · main · SiteFooter · BackToTop · ClientEnhancements"]
        ES --> SHELL
        EN --> SHELL
    end

    subgraph ROUTES["📄 Rutas (×2 idiomas, zero-flash)"]
        HOME["/ · Hero · Resumen · Explore · Autores · Contacto"]
        ANTE["/anteproyecto · Cap I–IV · Tablas · Reproducibilidad"]
        ING["/ingenieria · Datos · MLOps · Estructura · Modelo"]
        DAT["/datos-historicos · Boletines · Explorador"]
        REC["/recursos · Glosario(42) · Referencias(64)"]
    end
    SHELL --> HOME & ANTE & ING & DAT & REC

    subgraph CONTENT["📚 Contenido"]
        SH["SectionHTML (server)<br/>elige ES/EN → 0 JS al cliente"]
        GEN --> SH
        SH --> ANTE & ING & REC & HOME
    end

    subgraph DATA["📊 Datos reales"]
        CSV["public/data/visa_panel_long.csv<br/>27,611 filas"]
        FEED["raw.githubusercontent.com<br/>bulletins.json (feed vivo)"]
        EDA["public/data/eda_facts.json + eda_report.pdf ES/EN<br/>galería G1–G11 · 44 PNG (ES/EN × claro/oscuro)"]
        FE["public/data/fe_facts.json + fe_report.pdf ES/EN<br/>galería f01–f07 · 28 PNG · fig_dims.json medido en build"]
        LOAD["lib/data/visa-panel.ts"]
        CSV --> LOAD --> EXP["panel-explorer (Recharts, lazy)<br/>4 gráficas + tabla virtualizada"]
        FEED --> BOL["Boletines (feed)"]
        EDA --> EDASEC["Sección #eda<br/>censo + galería por idioma"]
        FE --> FESEC["Sección #fe<br/>decisiones magistrales + galería + PDF"]
        EXP --> DAT
        BOL --> DAT
        EDASEC --> DAT
        FESEC --> DAT
    end

    subgraph CROSS["🔁 Transversal"]
        I18N["lib/i18n.ts + site-map.ts<br/>toggle ES⇄EN navega /x ⇄ /en/x"]
        THEME["next-themes<br/>claro/oscuro sin FOUC"]
        ANALYTICS["lib/analytics.ts<br/>Plausible + 6 eventos custom"]
        SEO["lib/seo.ts<br/>canonical · hreflang · OG · Twitter"]
    end
    SHELL -.-> I18N & THEME & ANALYTICS
    ROUTES -.-> SEO

    subgraph DEPLOY["🚀 Netlify"]
        OUT["out/ (export estático)"]
        HDR["netlify.toml<br/>CSP · HSTS · headers · caché"]
        OUT --> HDR
    end
    ROUTES --> OUT
    SEOF --> OUT
    OG --> OUT
```

## Stack

- **Next.js 15** (App Router) · **TypeScript** · **Tailwind v4** · **shadcn-style primitives**
- **next-themes** (claro/oscuro sin FOUC) · **KaTeX** · **Recharts** · **TanStack Table + Virtual**
- **Export estático** (`output: "export"`, `trailingSlash`) → cualquier host estático
- **Plausible** (analítica cookieless + 6 eventos personalizados)

## Idioma y diseño

- **Bilingüe ES/EN con rutas reales** (`/x` y `/en/x`), **server-rendered por
  idioma → cero flash**. `lib/site-map.ts` + `lib/i18n.ts` son la fuente de
  verdad; `SectionHTML` es server component (el contenido no viaja al cliente).
- **Sistema editorial** (sin tarjetas con borde — reglas finas + tipografía).
  Modo oscuro inspirado en Linear / GitHub Dark Dimmed. Azul UACJ. WCAG AA.

## Contenido académico

Prosa, glosario (42) y referencias (64) se preservan **literales** desde
`content/source.html` (ES) y `content/en/*.html` (EN, traducción fiel validada)
y se transforman en build a `lib/content/sections.*generated.ts`. Datos reales
del repo `UACJ-MIAAD/VisaPredictAI`; sin valores inventados.

## Rutas y bundle

| Ruta (×2 idiomas) | Contenido | First Load JS |
|---|---|---|
| `/` · `/en` | Hero · Resumen · navegador · Autores · Contacto | ~111 kB |
| `/anteproyecto` | Capítulos I–IV · Tablas · Reproducibilidad | ~111 kB |
| `/ingenieria` | Panel · MLOps · Estructura · Modelo de datos | ~111 kB |
| `/datos-historicos` | Boletines en vivo · explorador interactivo | ~124 kB |
| `/recursos` | Glosario (42) · Referencias IEEE (64) | ~111 kB |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000 (corre el extractor antes)
npm run build      # genera contenido + export estático en out/
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

## SEO · social · PWA · seguridad

- **SEO**: canonical + hreflang `es⇄en`, `robots.txt`, `sitemap.xml`, JSON-LD.
- **Social**: Open Graph + Twitter cards + imagen OG generada (1200×630).
- **PWA/móvil**: `manifest.webmanifest`, `apple-touch-icon`, `favicon.ico` (multi-res), `theme-color`.
- **A11y**: skip-link, foco gestionado, AA, `prefers-reduced-motion`.
- **Seguridad** (`netlify.toml`): CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy + caché inmutable.

## Despliegue

- **Netlify**: `command = npm run build`, `publish = out` (`netlify.toml`). Auto-deploy desde `main`.
- Cualquier hosting estático sirve `out/`.

## Analítica — eventos personalizados de Plausible

**Dashboard de estadísticas:** https://plausible.io/visapredictai.com
(panel cookieless de visitas, fuentes, páginas y eventos).

`lib/analytics.ts` → `track()`. Eventos: `Language Switch`, `Theme Toggle`,
`Explore Section`, `Explore Historical CTA`, `CSV Export`, `Explorer Filter`.
Para verlos: registrarlos como **Goals → Custom event** en el panel de Plausible.
