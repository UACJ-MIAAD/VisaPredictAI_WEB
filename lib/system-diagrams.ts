import { BULLETIN_OPERATION } from "@/lib/bulletin-operation";
import type { Lang } from "@/lib/site-map";

export type DiagramCopy = Record<Lang, string>;
export const copy = (es: string, en: string): DiagramCopy => ({ es, en });
export type FlowNode = { id: string; title: DiagramCopy; detail: DiagramCopy; component?: string };
export type FlowEdge = { from: string; to: string; label?: DiagramCopy };
export type SystemFlow = {
  id: string;
  title: DiagramCopy;
  description: DiagramCopy;
  nodes: FlowNode[];
  edges: FlowEdge[];
  boundary: DiagramCopy;
  sources: { label: string; href: string }[];
};

const DATA = `https://github.com/UACJ-MIAAD/VisaPredictAI/blob/${BULLETIN_OPERATION.sourceCommit}/`;
const WEB = "https://github.com/UACJ-MIAAD/VisaPredictAI_WEB/blob/6790aa0ee96ae2c8546af7cd3fe0c0b0de2c401f/";
// The DDL catalog fixture was built at this published commit. Its source files
// are byte-identical in the October release; retain the catalog's exact origin.
const SCHEMA_DATA = "https://github.com/UACJ-MIAAD/VisaPredictAI/blob/a6036ec20eaf5ecb17b1cce43fe2ecea9436a82b/";
const node = (id: string, es: string, en: string, detailEs: string, detailEn: string, component?: string): FlowNode =>
  ({ id, title: copy(es, en), detail: copy(detailEs, detailEn), component });
const chain = (nodes: FlowNode[]): FlowEdge[] => nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
const flow = (id: string, title: DiagramCopy, description: DiagramCopy, nodes: FlowNode[], boundary: DiagramCopy, paths: string[], web = false, edges?: FlowEdge[]): SystemFlow =>
  ({ id, title, description, nodes, edges: edges ?? chain(nodes), boundary, sources: paths.map((p) => ({ label: p, href: (web ? WEB : DATA) + p })) });

export const COMPONENT_FLOWS: SystemFlow[] = [
  flow("ingesta", copy("Del PDF al almacén y al corte", "From PDF to warehouse and release"),
    copy("La persona aporta la fuente oficial; Make automatiza la extracción y la validación. Preparación y publicación tienen límites distintos.", "A person supplies the official source; Make automates extraction and validation. Preparation and publication have separate boundaries."), [
      node("pdf", "PDF oficial", "Official PDF", "Descarga humana y comprobación del mes", "Human download and month check"),
      node("inbox", "Carpeta de entrada", "Input folder", "data/inbox · un PDF identificado", "data/inbox · one identified PDF"),
      node("texto", "Make y texto", "Make and text", "Texto posicionado, original conservado", "Positioned text, original retained"),
      node("tablas", "Cuatro matrices", "Four tables", "País, categoría, FAD/DFF y estados", "Country, category, FAD/DFF and statuses"),
      node("validar", "Validación cerrada", "Closed validation", "Mes, duplicados, omisiones y procedencia", "Month, duplicates, omissions and provenance"),
      node("candidato", "Panel y DuckDB", "Panel and DuckDB", "Candidato aislado; nada vivo se sustituye", "Isolated candidate; no live replacement"),
      node("recibo", "Recibo y evidencia", "Receipt and evidence", "Original, texto, hashes y resultados", "Original, text, hashes and results"),
      node("publicar", "Publicación explícita", "Explicit publication", "PUBLISH=1 · circuito mensual y entrega", "PUBLISH=1 · monthly path and delivery"),
      node("rechazo", "Rechazo trazable", "Traceable rejection", "Sin publicación; diagnóstico conservado", "No publication; diagnosis retained"),
    ], copy("La preparación local no sube S3 ni dispara el cron. Publicar requiere la opción explícita, sus gates y verificación del corte servido. Un PDF ambiguo no se completa a ojo; el bloqueo de la fuente no se declara resuelto.", "Local preparation neither uploads to S3 nor dispatches the cron. Publishing requires the explicit option, its gates and verification of the served release. Ambiguous PDFs are not completed by guesswork; source blocking is not declared resolved."),
    ["Makefile", "docs/ASSISTED_BULLETIN.md", "pipeline/ingest_pdf.py", "pipeline/bulletin.py"], false, [
      { from: "pdf", to: "inbox" }, { from: "inbox", to: "texto" },
      { from: "texto", to: "tablas" }, { from: "tablas", to: "validar" },
      { from: "validar", to: "candidato", label: copy("válido", "valid") },
      { from: "validar", to: "rechazo", label: copy("inválido", "invalid") },
      { from: "candidato", to: "recibo" },
      { from: "recibo", to: "publicar", label: copy("revisión humana", "human review") },
    ]),
  flow("panel", copy("Panel y almacén analítico", "Panel and analytical warehouse"),
    copy("El panel normalizado alimenta tanto el almacén SQL como las exportaciones; la base se reconstruye, no se consulta desde el navegador.", "The normalized panel feeds both the SQL warehouse and exports; the database is rebuilt, not queried by the browser."), [
      node("html", "Instantáneas HTML", "HTML snapshots", "Entradas congeladas del pipeline", "Frozen pipeline inputs"),
      node("parseo", "Extracción", "Extraction", "Tablas del boletín a CSV crudo", "Bulletin tables to raw CSV"),
      node("normalizar", "Panel normalizado", "Normalized panel", "Etiquetas, fechas, estados y ledger de limpieza", "Labels, dates, statuses and cleaning ledger"),
      node("sql", "DuckDB", "DuckDB", "Migraciones, carga, restricciones y procedencia", "Migrations, loading, constraints and provenance"),
      node("exportar", "Vistas y Parquet", "Views and Parquet", "Consulta analítica y exportación reproducible", "Analytical queries and reproducible export"),
    ], copy("El DAG también deriva el feed de boletines, los hechos canónicos y los resúmenes EDA/FE desde sus dependencias; no son consultas web en vivo.", "The DAG also derives the bulletin feed, canonical facts and EDA/FE summaries from their dependencies; these are not live web queries."),
    ["dvc.yaml", "pipeline/build_database.py", "schema.sql"]),
  flow("modelado", copy("Características y pronóstico", "Features and forecasting"),
    copy("Las series históricas se transforman y se evalúan respetando la separación temporal antes de emitir pronósticos.", "Historical series are transformed and evaluated with temporal separation before forecasts are emitted."), [
      node("series", "Series del almacén", "Warehouse series", "Categoría × área × tabla desde DuckDB", "Category × area × table from DuckDB"),
      node("features", "Transformaciones causales", "Causal transformations", "Rezagos y transformaciones causales", "Lags and causal transformations"),
      node("ajuste", "Entrenamiento", "Training", "Modelos y recetas del catálogo", "Catalog models and recipes"),
      node("evaluacion", "Evaluación temporal", "Temporal evaluation", "Selección y reservado separados", "Separate selection and hold-out data"),
      node("forecast", "Pronóstico del campeón", "Champion forecast", "Puntos, intervalos y metadatos", "Points, intervals and metadata"),
    ], copy("Sólo el estado F aporta el objetivo numérico de entrenamiento. Una comparación retrospectiva favorable no autoriza por sí sola una promoción.", "Only status F supplies the numeric training target. A favorable retrospective comparison does not itself authorize promotion."),
    ["vp_model/feature_builder.py", "experiments/generate_web_forecasts.py", "docs/ARCHITECTURE.md"]),
  flow("evaluacion", copy("Evaluación prospectiva y sombra", "Prospective evaluation and shadow"),
    copy("La predicción se conserva antes de conocer la observación futura. Campeón y retador mantienen registros separados.", "A prediction is retained before the future observation is known. Champion and challenger keep separate records."), [
      node("emitir", "Pronóstico emitido", "Issued forecast", "Añada y receta identificadas", "Identified vintage and recipe"),
      node("ledger", "Ledger inmutable", "Immutable ledger", "Registros de campeón y sombra separados", "Separate champion and shadow records"),
      node("real", "Nuevo boletín", "New bulletin", "Observación posterior realmente publicada", "Subsequently published observation"),
      node("puntuar", "Puntuación prospectiva", "Prospective scoring", "Error, cobertura y pares comparables", "Error, coverage and comparable pairs"),
      node("gate", "Gate de promoción", "Promotion gate", "Política pre-registrada y decisión humana", "Pre-registered policy and human decision"),
    ], copy("Sin evidencia suficiente se prolonga la sombra. El diagrama describe el circuito, no anuncia una promoción ni nuevos resultados.", "Insufficient evidence extends shadow operation. This diagram describes the loop; it announces neither promotion nor new results."),
    ["docs/MLOPS_ARCHITECTURE.md", "reports/governance/champion_manifest.json"]),
  flow("publicacion", copy("Gobernanza y corte publicado", "Governance and published release"),
    copy("Los documentos y las cifras se contrastan antes de sellar el conjunto de archivos que consumirá el sitio.", "Documents and figures are checked before sealing the file bundle consumed by the site."), [
      node("artefactos", "Artefactos derivados", "Derived artifacts", "CSV, JSON, figuras y hechos canónicos", "CSV, JSON, figures and canonical facts"),
      node("consistencia", "Consistencia cruzada", "Cross-repository consistency", "Una autoridad para las cifras públicas", "One authority for public figures"),
      node("manifiesto", "Manifiesto de release", "Release manifest", "Identidad, tamaño y SHA-256 de los artefactos", "Artifact identity, size and SHA-256"),
      node("controles", "Revisión y transacción", "Review and transaction", "CI del candidato, recibo humano y publicación gobernada", "Candidate CI, human receipt and governed publication"),
      node("consumidores", "Consumidores del corte", "Release consumers", "Portal, RAG y archivos de descarga", "Portal, RAG and downloadable files"),
    ], copy("La reconciliación acredita las salidas; el recibo humano vincula el candidato exacto y la transacción autoriza su publicación. La campaña G7 ya completó ese circuito. El cron mensual mantiene su propia cadena de gates.", "Reconciliation accredits outputs; the human receipt binds the exact candidate and the transaction authorizes publication. The G7 campaign has completed this loop. The monthly cron retains its own gate chain."),
    ["docs/adr/0003-campaign-transaction.md", "vp_model/vinculo_publicacion.py", "tools/campaign_txn.py"]),
  flow("web", copy("Construcción y entrega del portal", "Portal build and delivery"),
    copy("El navegador recibe una exportación estática; los datos se verifican durante la construcción.", "The browser receives a static export; data is verified during the build."), [
      node("corte", "Corte de datos publicado", "Published data release", "Manifiesto y artefactos remotos", "Remote manifest and artifacts"),
      node("verificar", "Descarga verificada", "Verified download", "Staging, hashes, contratos y rollback", "Staging, hashes, contracts and rollback"),
      node("construir", "Build de Next.js", "Next.js build", "Contenido bilingüe, estadísticas e índice RAG", "Bilingual content, statistics and RAG index"),
      node("netlify", "Netlify", "Netlify", "Exportación estática y función de chat", "Static export and chat function"),
      node("navegador", "Navegador", "Browser", "Exploradores, gráficos y lectura del sitio", "Explorers, charts and site reading"),
    ], copy("Si la descarga falla, el consumidor conserva un conjunto coherente y declara su estado. No hay una conexión directa del navegador a DuckDB.", "If download fails, the consumer retains a coherent bundle and reports its state. The browser has no direct connection to DuckDB."),
    ["scripts/fetch-data.mjs", "package.json", "next.config.mjs"], true),
  flow("asistente", copy("VisaBot y recuperación de evidencia", "VisaBot and evidence retrieval"),
    copy("La consulta combina recuperación documental y contexto estructurado; la respuesta vuelve con sus fuentes.", "A query combines document retrieval and structured context; the answer returns with its sources."), [
      node("pregunta", "Pregunta", "Question", "Consulta del visitante y contexto de la vista", "Visitor query and view context"),
      node("recuperar", "Recuperación local", "Local retrieval", "BM25; recuperación densa con consentimiento", "BM25; dense retrieval with consent"),
      node("combinar", "Fusión y selección", "Fusion and selection", "RRF y MMR seleccionan la evidencia", "RRF and MMR select evidence"),
      node("servidor", "Función de chat", "Chat function", "Valida contexto; reconstruye datos sintéticos", "Validates context; reconstructs synthetic data"),
      node("respuesta", "Modelo y respuesta citada", "Model and cited answer", "Generación remota y respuesta en streaming", "Remote generation and streamed answer"),
    ], copy("La búsqueda densa es opcional. El servidor comprueba los documentos y no confía en cifras sintéticas enviadas como texto libre por el navegador.", "Dense search is optional. The server checks documents and does not trust synthetic figures sent as free text by the browser."),
    ["lib/visabot/retrieval-core.mjs", "netlify/functions/chat.mjs", "lib/visabot/synthetic-context.mjs"], true),
  flow("documentos", copy("Documentación y reproducibilidad", "Documentation and reproducibility"),
    copy("Las cifras del estudio se derivan antes de incorporarse a los documentos y las superficies públicas.", "Study figures are derived before entering documents and public surfaces."), [
      node("facts", "Hechos canónicos", "Canonical facts", "key_facts y exportaciones derivadas", "key_facts and derived exports"),
      node("latex", "Tesis y paper", "Thesis and paper", "Macros, figuras y prosa contrastada", "Macros, figures and checked prose"),
      node("ci", "CI documental", "Document CI", "Compilación y puertas del documento", "Compilation and document gates"),
      node("lectura", "Publicación documental", "Document publication", "GitHub y compilación local verificada", "GitHub and verified local compilation"),
    ], copy("El repositorio documental es la autoridad académica; el portal consume sus exportaciones. El contenido nuevo requiere reconciliación, no copiar cifras a mano.", "The document repository is the academic authority; the portal consumes its exports. New content requires reconciliation, not manually copied figures."),
    ["docs/ARCHITECTURE.md", "dvc.yaml"]),
  flow("operacion", copy("Operación mensual y observabilidad", "Monthly operation and observability"),
    copy("La automatización conecta las etapas y conserva tanto los resultados como las señales de error y deriva.", "Automation connects the stages and retains results as well as error and drift signals."), [
      node("cron", "Disparo mensual", "Monthly trigger", "Orquestación y comprobación de la fuente", "Orchestration and source checks"),
      node("ejecutar", "Pipeline y pronósticos", "Pipeline and forecasts", "DVC, modelado y artefactos derivados", "DVC, modeling and derived artifacts"),
      node("informes", "EDA e informes", "EDA and reports", "Cada productor debe terminar correctamente", "Every producer must finish successfully"),
      node("observar", "Gobernanza y deriva", "Governance and drift", "Consistencia, estado y señales de cambio", "Consistency, status and change signals"),
      node("puerta", "Gate y CI", "Gate and CI", "Publicación condicionada al SHA validado", "Publication conditioned on the validated SHA"),
      node("avisos", "Tracking y avisos", "Tracking and notifications", "Registro JSONL, correo SES e incidencias", "JSONL log, SES email and issues"),
    ], copy("El sellado exige EDA completo y contraste con los documentos; la entrega sólo parte de main con su CI verde. Un fallo conserva su diagnóstico y no publica un corte parcial. La deriva informa, pero no promueve modelos por sí sola.", "Sealing requires complete EDA and documentary checks; delivery runs only from main with green CI. A failure retains its diagnosis and does not publish a partial release. Drift informs but does not promote models on its own."),
    [".github/workflows/freeze_and_rebuild.yml", "docs/MLOPS_ARCHITECTURE.md", "dvc.yaml"]),
];

export const SYSTEM_FLOW: SystemFlow = {
  id: "general",
  title: copy("Del boletín a la evidencia que ves", "From the bulletin to the evidence you see"),
  description: copy("Sigue las flechas y abre cada componente para ver su circuito. Los enlaces de código apuntan a versiones publicadas, no a trabajo local pendiente.", "Follow the arrows and open each component to inspect its flow. Code links point to published versions, not pending local work."),
  nodes: [
    node("fuente", "Fuente y archivo", "Source and archive", "PDF humano → Make → fuente validada", "Human PDF → Make → validated source", "ingesta"),
    node("panel", "Panel normalizado", "Normalized panel", "Extracción y limpieza trazables", "Traceable extraction and cleaning", "panel"),
    node("almacen", "Almacén analítico", "Analytical warehouse", "DuckDB, vistas y Parquet", "DuckDB, views and Parquet", "panel"),
    node("modelo", "Modelado", "Modeling", "Series y transformaciones causales", "Series and causal transformations", "modelado"),
    node("evaluar", "Evaluación", "Evaluation", "Reservado, prospectivo y sombra", "Hold-out, prospective and shadow", "evaluacion"),
    node("gobierno", "Gobernanza", "Governance", "Consistencia y puertas del corte", "Consistency and release gates", "publicacion"),
    node("release", "Corte sellado", "Sealed release", "Manifiesto y artefactos verificables", "Manifest and verifiable artifacts", "publicacion"),
    node("portal", "Portal bilingüe", "Bilingual portal", "Build estático y exploración", "Static build and exploration", "web"),
    node("bot", "VisaBot", "VisaBot", "Recuperación y respuestas citadas", "Retrieval and cited answers", "asistente"),
    node("docs", "Tesis y paper", "Thesis and paper", "Documentos y figuras derivados", "Derived documents and figures", "documentos"),
    node("operar", "Operación mensual", "Monthly operation", "Operación asistida y evidencia por corrida", "Assisted operation and per-run evidence", "operacion"),
  ],
  edges: [
    { from: "fuente", to: "panel" }, { from: "panel", to: "almacen" },
    { from: "almacen", to: "modelo" }, { from: "modelo", to: "evaluar" },
    { from: "evaluar", to: "gobierno" }, { from: "gobierno", to: "release" },
    { from: "release", to: "portal" }, { from: "portal", to: "bot" },
    { from: "gobierno", to: "docs" },
    { from: "gobierno", to: "operar" }, { from: "operar", to: "fuente" },
  ],
  boundary: copy("DuckDB se usa dentro del pipeline y el análisis. El portal consume archivos del corte publicado; el asistente añade una función de servidor para generar la respuesta. El mapa muestra dependencias de información, no una única ejecución secuencial.", "DuckDB runs inside the pipeline and analysis. The portal consumes published release files; the assistant adds a server function to generate its answer. This map shows information dependencies, not one sequential execution."),
  sources: [{ label: "docs/ARCHITECTURE.md", href: DATA + "docs/ARCHITECTURE.md" }, { label: "dvc.yaml", href: DATA + "dvc.yaml" }],
};

export const DATABASE_SOURCES = ["schema.sql", "pipeline/migrations/002_provenance_and_timestamps.sql", "docs/er_diagram.md"].map((p) => ({ label: p, href: SCHEMA_DATA + p }));
