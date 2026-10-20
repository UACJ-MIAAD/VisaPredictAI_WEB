import Link from "next/link";
import type { Lang } from "@/lib/site-map";
import { localePath } from "@/lib/site-map";
import { COMPONENT_FLOWS, DATABASE_SOURCES, SYSTEM_FLOW, type SystemFlow } from "@/lib/system-diagrams";
import { DATABASE_ENTITIES, DATABASE_RELATIONS, DATABASE_VIEWS } from "@/lib/database-diagram";
import "./system-diagrams.css";

const T = {
  es: {
    kicker: "Mapa del sistema", title: "Cómo se conecta VisaPredictAI",
    intro: "Un recorrido completo por la fuente, el procesamiento, los modelos y la entrega. Después, cada componente por separado y el esquema de la base de datos.",
    components: "Explorar los componentes", overview: "Vista general", code: "Ver la implementación", text: "Leer conexiones en texto", to: "→", open: "Abrir componente",
    database: "Base de datos", dbTitle: "Un almacén estrella, con procedencia",
    dbIntro: "DuckDB es un almacén analítico embebido del pipeline. Conserva los estados del boletín, las dimensiones compartidas y la identidad de la construcción. El portal consume exportaciones verificadas, no conexiones SQL en vivo.",
    dimension: "Dimensión", fact: "Hecho", provenance: "Procedencia", foreign: "FK SQL · N → 1", asserted: "Comprobado en código · N → 1", byValue: "Cruce por valor · N → 1",
    legend: "Cómo leer las relaciones", columns: "Columnas", pk: "Clave primaria", relations: "Relaciones y cardinalidad", views: "Vistas de consulta", tableDetails: "Tablas y campos",
    note: "Las líneas continuas son claves foráneas declaradas en SQL. Las discontinuas unen los hechos a la ejecución ETL mediante comprobaciones del constructor. La línea de puntos relaciona la añada del HTML con el mes; no es una FK.",
    modelNote: "El esquema incluye la migración de procedencia. La explicación académica original y su dibujo anterior a esa migración se conservan en Modelo de datos.",
    details: "Leer la explicación del modelo", plan: "Consultar el estado del plan", scope: "Arquitectura contrastada con el código publicado del corte reconciliado. Consulta el tablero para el avance y las observaciones pendientes.",
    invariants: "Contratos que importan", invariant1: "FAD y DFF son tablas distintas. DV se registra por región y mes, sin esa división.",
    invariant2: "Sólo F define una fecha o un rango numérico. C, U y UNK conservan el estado administrativo.",
    invariant3: "parent_code es descriptivo, no una FK recursiva. Los alias guardan el intervalo observado, no una historia SCD-2.",
  },
  en: {
    kicker: "System map", title: "How VisaPredictAI connects",
    intro: "A complete journey through the source, processing, models and delivery. Then, each component on its own and the database schema.",
    components: "Explore the components", overview: "Overview", code: "View implementation", text: "Read connections as text", to: "→", open: "Open component",
    database: "Database", dbTitle: "A star warehouse, with provenance",
    dbIntro: "DuckDB is an embedded analytical warehouse in the pipeline. It retains bulletin statuses, shared dimensions and build identity. The portal consumes verified exports, not live SQL connections.",
    dimension: "Dimension", fact: "Fact", provenance: "Provenance", foreign: "SQL FK · N → 1", asserted: "Checked in code · N → 1", byValue: "Join by value · N → 1",
    legend: "Reading the relationships", columns: "Columns", pk: "Primary key", relations: "Relationships and cardinality", views: "Query views", tableDetails: "Tables and fields",
    note: "Solid lines are foreign keys declared in SQL. Dashed lines link facts to the ETL run through builder checks. The dotted line joins the HTML vintage to the month; it is not a foreign key.",
    modelNote: "The schema includes the provenance migration. The original academic explanation and its earlier diagram remain in Data model.",
    details: "Read the model explanation", plan: "View plan status", scope: "Architecture checked against the published code of the reconciled release. See the board for progress and outstanding observations.",
    invariants: "Contracts that matter", invariant1: "FAD and DFF are separate tables. DV is recorded by region and month, without that split.",
    invariant2: "Only F defines a numeric date or rank. C, U and UNK retain the administrative status.",
    invariant3: "parent_code is descriptive, not a recursive FK. Aliases hold the observed envelope, not an SCD-2 history.",
  },
};

function Sources({ items, lang }: { items: SystemFlow["sources"]; lang: Lang }) {
  return <div className="system-sources">
    <span>{T[lang].code}</span>
    {items.map((s) => <a key={s.href} href={s.href} target="_blank" rel="noreferrer">{s.label}<span className="sr-only"> ({lang === "es" ? "nueva pestaña" : "new tab"})</span></a>)}
  </div>;
}

// A serpentine layout keeps individual steps readable. On narrow screens the
// same graph is a vertical list with explicit outbound connections, not a
// scaled-down picture. SVG and text share the same node/edge data.
function FlowDiagram({ flow, lang }: { flow: SystemFlow; lang: Lang }) {
  const positions = new Map(flow.nodes.map((n, i) => {
    const row = Math.floor(i / 3);
    return [n.id, { x: 20 + (row % 2 ? 2 - i % 3 : i % 3) * 330, y: 20 + row * 142 }];
  }));
  const height = Math.ceil(flow.nodes.length / 3) * 142;
  const marker = `arrow-${flow.id}`;
  const nodeTitle = (id: string) => flow.nodes.find((n) => n.id === id)!.title[lang];
  const list = <ol className="system-flow-list">
    {flow.nodes.map((n) => <li key={n.id}>
      <strong>{n.component ? <a href={`#componente-${n.component}`}>{n.title[lang]}</a> : n.title[lang]}</strong>
      <p>{n.detail[lang]}</p>
      {flow.edges.some((e) => e.from === n.id) && <p className="system-outgoing">{flow.edges.filter((e) => e.from === n.id).map((e, i) => <span key={e.to}>{i ? " · " : ""}{T[lang].to} {nodeTitle(e.to)}{e.label ? ` (${e.label[lang]})` : ""}</span>)}</p>}
    </li>)}
  </ol>;
  return <figure className="system-flow" aria-labelledby={`${flow.id}-caption`}>
    <figcaption id={`${flow.id}-caption`} className="system-flow-caption">{flow.title[lang]}</figcaption>
    <svg className="system-flow-svg" viewBox={`0 0 1000 ${height}`} role="img" aria-labelledby={`${flow.id}-svg-title ${flow.id}-svg-desc`}>
      <title id={`${flow.id}-svg-title`}>{flow.title[lang]}</title>
      <desc id={`${flow.id}-svg-desc`}>{flow.description[lang]} {T[lang].text}.</desc>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" /></marker></defs>
      {flow.edges.map((edge) => {
        const a = positions.get(edge.from)!; const b = positions.get(edge.to)!;
        const sameRow = a.y === b.y;
        const sx = sameRow ? a.x + (b.x > a.x ? 290 : 0) : a.x + 145;
        const sy = sameRow ? a.y + 48 : a.y + 96;
        const ex = sameRow ? b.x + (b.x > a.x ? -4 : 294) : b.x + 145;
        const ey = sameRow ? b.y + 48 : b.y - 4;
        const path = sameRow ? `M ${sx} ${sy} H ${ex}`
          : b.y < a.y ? `M ${sx} ${sy} V ${sy + 16} H 8 V ${ey - 10} H ${ex} V ${ey}`
          : b.y - a.y > 142 ? `M ${sx} ${sy} V ${sy + 22} H 990 V ${ey - 22} H ${ex} V ${ey}`
          : `M ${sx} ${sy} V ${sy + 22} H ${ex} V ${ey}`;
        return <g key={`${edge.from}-${edge.to}`}><path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" markerEnd={`url(#${marker})`} />
          {edge.label && <text x={(sx + ex) / 2} y={sy + 17} textAnchor="middle" className="system-edge-label">{edge.label[lang]}</text>}
        </g>;
      })}
      {flow.nodes.map((n, i) => {
        const { x, y } = positions.get(n.id)!;
        return <g key={n.id} transform={`translate(${x} ${y})`}>
          <rect width="290" height="96" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" />
          <rect width="3" height="96" fill="var(--color-accent)" />
          <text x="17" y="25" className="system-node-step">{String(i + 1).padStart(2, "0")}</text>
          <text x="17" y="48" className="system-node-title">{n.title[lang]}</text>
          <foreignObject x="17" y="58" width="256" height="34"><div className="system-node-detail">{n.detail[lang]}</div></foreignObject>
        </g>;
      })}
    </svg>
    <div className="system-mobile-graph">{list}</div>
    <details className="system-text-graph">
      <summary>{T[lang].text}</summary>
      {list}
    </details>
    <p className="system-boundary">{flow.boundary[lang]}</p>
  </figure>;
}

export function SystemArchitecture({ lang, className }: { lang: Lang; className?: string }) {
  const t = T[lang];
  return <section id="sistema" className={`${className ?? "section"} system-atlas`}>
    <div className="section-inner">
      <p className="system-kicker">{t.kicker}</p><h2>{t.title}</h2>
      <p className="system-lead">{t.intro}</p>
      <nav className="system-index" aria-label={t.components}>
        <a href="#general-caption">{t.overview}</a>
        {COMPONENT_FLOWS.map((f) => <a key={f.id} href={`#componente-${f.id}`}>{f.title[lang]}</a>)}
        <a href="#base-datos">{t.database}</a>
      </nav>
      <FlowDiagram flow={SYSTEM_FLOW} lang={lang} />
      <Sources items={SYSTEM_FLOW.sources} lang={lang} />
      <h3 className="system-components-heading">{t.components}</h3>
      <div className="system-components">
        {COMPONENT_FLOWS.map((f, i) => <details key={f.id} id={`componente-${f.id}`} className="system-component" open={i === 0}>
          <summary><span className="system-component-number">{String(i + 1).padStart(2, "0")}</span><span>{f.title[lang]}</span><span className="system-toggle" aria-hidden="true">+</span></summary>
          <div className="system-component-body"><p>{f.description[lang]}</p><FlowDiagram flow={f} lang={lang} /><Sources items={f.sources} lang={lang} /></div>
        </details>)}
      </div>
      <p className="system-scope">{t.scope} <Link href={localePath("/plan", lang)}>{t.plan} →</Link></p>
    </div>
  </section>;
}

export function DatabaseDiagram({ lang, className }: { lang: Lang; className?: string }) {
  const t = T[lang];
  const kinds = { dimension: t.dimension, fact: t.fact, provenance: t.provenance };
  const relationLabels = { "foreign-key": t.foreign, asserted: t.asserted, "by-value": t.byValue };
  return <section id="base-datos" className={`${className ?? "section"} system-atlas`}>
    <div className="section-inner">
      <p className="system-kicker">{t.database} · DuckDB</p><h2>{t.dbTitle}</h2>
      <p className="system-lead">{t.dbIntro}</p>
      <ul className="system-legend" aria-label={t.legend}>
        {Object.entries(kinds).map(([kind, label]) => <li key={kind}><span className={`system-kind-dot system-kind-${kind}`} />{label}</li>)}
        {Object.entries(relationLabels).map(([kind, label]) => <li key={kind}><span className={`system-line system-line-${kind}`} />{label}</li>)}
      </ul>
      <figure className="system-er" tabIndex={0} aria-label={t.dbTitle}>
        <svg viewBox="0 0 1200 510" role="img" aria-labelledby="er-title er-desc">
          <title id="er-title">{t.dbTitle}</title><desc id="er-desc">{t.note} {t.tableDetails}: {DATABASE_ENTITIES.map((e) => e.id).join(", ")}.</desc>
          <defs><marker id="er-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-muted)" /></marker></defs>
          {DATABASE_RELATIONS.map((r, i) => {
            const a = DATABASE_ENTITIES.find((e) => e.id === r.from)!;
            const b = DATABASE_ENTITIES.find((e) => e.id === r.to)!;
            const sameRow = a.y === b.y && Math.abs(a.x - b.x) === 1;
            const acrossRow = a.y === b.y && !sameRow;
            const ax = 12 + a.x * 300 + (sameRow ? b.x > a.x ? 270 : 0 : 135);
            const ay = 14 + a.y * 170 + (sameRow ? 52 : b.y > a.y || acrossRow ? 104 : 0);
            const bx = 12 + b.x * 300 + (sameRow ? b.x > a.x ? -3 : 273 : 135);
            const by = 14 + b.y * 170 + (sameRow ? 52 : b.y > a.y && !acrossRow ? -3 : 107);
            // Use the inter-row gutter, never route through table labels.
            const gutter = (a.y <= b.y ? ay + 24 : ay - 24) + (i % 3) * 5;
            const d = sameRow ? `M ${ax} ${ay} H ${bx}` : `M ${ax} ${ay} V ${gutter} H ${bx} V ${by}`;
            return <path key={`${r.from}-${r.column}`} d={d} fill="none" stroke="var(--color-muted)" strokeWidth="1.4" strokeDasharray={r.kind === "asserted" ? "7 4" : r.kind === "by-value" ? "2 4" : undefined} markerEnd="url(#er-arrow)" />;
          })}
          {DATABASE_ENTITIES.map((e) => <g key={e.id} transform={`translate(${12 + e.x * 300} ${14 + e.y * 170})`}>
            <rect width="270" height="104" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" />
            <rect width="270" height="3" className={`system-kind-fill-${e.kind}`} />
            <text x="13" y="27" className="system-er-kind">{kinds[e.kind]}</text>
            <text x="13" y="52" className="system-er-title">{e.id}</text>
            <text x="13" y="75" className="system-er-key">PK {e.primaryKey.length > 2 ? e.primaryKey.slice(0, 2).join(", ") + ", …" : e.primaryKey.join(", ")}</text>
            <text x="13" y="93" className="system-er-key">{e.columns.filter((c) => !e.primaryKey.includes(c)).slice(0, 2).join(" · ")}</text>
          </g>)}
        </svg>
        <figcaption>{t.note}</figcaption>
      </figure>
      <div className="system-db-invariants"><h3>{t.invariants}</h3><ul><li>{t.invariant1}</li><li>{t.invariant2}</li><li>{t.invariant3}</li></ul></div>
      <h3 className="system-components-heading">{t.tableDetails}</h3>
      <div className="system-entities">
        {DATABASE_ENTITIES.map((e) => <details key={e.id} id={`tabla-${e.id}`} className={`system-entity system-entity-${e.kind}`}>
          <summary><span><span className="system-entity-kind">{kinds[e.kind]}</span><code>{e.id}</code></span><span className="system-toggle" aria-hidden="true">+</span></summary>
          <div className="system-entity-body"><p>{e.purpose[lang]}</p><p><strong>{t.pk}:</strong> <code>{e.primaryKey.join(" + ")}</code></p>
            <h4>{t.columns}</h4><ul className="system-column-list">{e.columns.map((c) => <li key={c}><code>{c}</code>{e.primaryKey.includes(c) ? " · PK" : ""}</li>)}</ul>
            {DATABASE_RELATIONS.some((r) => r.from === e.id) && <><h4>{t.relations}</h4><ul className="system-relation-list">{DATABASE_RELATIONS.filter((r) => r.from === e.id).map((r) => <li key={r.column}><code>{r.column}</code> → <a href={`#tabla-${r.to}`}><code>{r.to}.{r.target}</code></a><span>{relationLabels[r.kind]}</span></li>)}</ul></>}
          </div>
        </details>)}
      </div>
      <details className="system-views"><summary>{t.relations}</summary><ul>{DATABASE_RELATIONS.map((r) => <li key={`${r.from}-${r.column}`}><code>{r.from}.{r.column}</code> → <code>{r.to}.{r.target}</code><span>{relationLabels[r.kind]}</span></li>)}</ul></details>
      <div className="system-views"><h3>{t.views}</h3><ul>{DATABASE_VIEWS.map((v) => <li key={v}><code>{v}</code></li>)}</ul></div>
      <Sources items={DATABASE_SOURCES} lang={lang} />
      <p className="system-scope">{t.modelNote} <a href="#modelo">{t.details} →</a></p>
    </div>
  </section>;
}
