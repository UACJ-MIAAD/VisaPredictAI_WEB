import type { Lang } from "@/lib/site-map";

export type PlanStatus =
  | "done"
  | "observing"
  | "active"
  | "planned"
  | "deferred"
  | "paused";

type Copy = { es: string; en: string };

export type PlanStory = {
  id: string;
  title: Copy;
  outcome: Copy;
  status: PlanStatus;
  evidence?: string;
};

export type PlanEpic = {
  id: string;
  title: Copy;
  summary: Copy;
  status: PlanStatus;
  stories: PlanStory[];
};

export type PlanUpdate = {
  date: string;
  title: Copy;
  detail: Copy;
  status: PlanStatus;
};

export type PlanDay = {
  date: string;
  updates: PlanUpdate[];
};

const c = (es: string, en: string): Copy => ({ es, en });
const story = (
  id: string,
  title: Copy,
  outcome: Copy,
  status: PlanStatus,
  evidence?: string,
): PlanStory => ({ id, title, outcome, status, evidence });

// Sólo hechos que ningún dato del plan puede derivar. La fase actual, la siguiente historia y la
// fecha de actualización se calculan en `planFocus()`: cablearlas aquí es lo que dejó la cabecera
// anunciando «D9 → D8» meses después de entregar ambas.
export const PLAN_META = {
  dataMain: "17eb7a9593d512387dcb6babb60549deecdd3ab8",
  releaseId: "2026-09-158ec972c234",
  releaseStatus: "fresh",
  observation: { current: 0, target: 2 },
} as const;

export const PLAN_EPICS: PlanEpic[] = [
  {
    id: "0",
    title: c("Preparar main sin perder nada", "Prepare main without losing work"),
    summary: c(
      "Base aislada, backports, CI mínimo e higiene con recuperación demostrada.",
      "Isolated baseline, backports, minimum CI and cleanup with proven recovery.",
    ),
    status: "done",
    stories: [
      story("0.1", c("Worktree de integración", "Integration worktree"), c("Aislar main del trabajo R9 preservado.", "Keep main isolated from the preserved R9 work."), "done"),
      story("0.2", c("Reauditar el diagrama ER", "Re-audit the ER diagram"), c("Portar el diagrama y su generador con equivalencia visual.", "Port the diagram and generator with visual equivalence."), "done"),
      story("0.3", c("Backports LaTeX", "LaTeX backports"), c("Integrar y compilar los documentos sin perder ramas.", "Integrate and compile the documents without losing branches."), "done"),
      story("0.4", c("CI mínimo viable", "Minimum viable CI"), c("Mantener un ci-gate estricto y una historia lineal.", "Keep a strict ci-gate and linear history."), "done"),
      story("0.5", c("Preservar PR #4", "Preserve PR #4"), c("Mantener R9 abierto y en draft hasta una decisión independiente.", "Keep R9 open and in draft pending an independent decision."), "done"),
      story("0.6", c("Higiene verificable", "Verifiable cleanup"), c("Limpiar sólo blancos acreditados y conservar recibos de recuperación.", "Clean only accredited targets and retain recovery receipts."), "done"),
      story("0.7", c("Documentación de estado", "State documentation"), c("Registrar únicamente hechos consumados y SHAs comprobados.", "Record only completed facts and verified SHAs."), "done"),
    ],
  },
  {
    id: "A",
    title: c("Carga del boletín", "Bulletin ingestion"),
    summary: c(
      "Ingesta manual segura y cron resiliente ante el bloqueo de la fuente oficial.",
      "Safe manual ingestion and a cron resilient to the official source being blocked.",
    ),
    status: "done",
    stories: [
      story("A1", c("Puerto único de red", "Single network port"), c("Inyectar el fetcher, aplicar un retry y tipar el bloqueo WAF.", "Inject the fetcher, apply one retry and type WAF blocking."), "done"),
      story("A2", c("Ingesta manual validada", "Validated manual ingestion"), c("Validar, promover atómicamente y subir a S3 en modo create-only.", "Validate, promote atomically and upload to S3 in create-only mode."), "done"),
      story("A3", c("Cron resiliente", "Resilient cron"), c("Separar el acceso a la fuente de los gates, CI y publicación.", "Separate source access from gates, CI and publishing."), "done"),
      story("A4", c("Señal honesta", "Honest signal"), c("Versionar el estado de fuente y mantener una issue canónica.", "Version source state and maintain one canonical issue."), "done"),
      story("A5", c("Pruebas sin red", "Offline tests"), c("Cubrir fetch, freeze e ingesta sin depender de Internet.", "Cover fetch, freeze and ingestion without depending on the Internet."), "done"),
      story("A6", c("BrowserFetcher", "BrowserFetcher"), c("Spike opcional y acotado; el ritual manual sigue siendo la ruta fiable.", "Optional time-boxed spike; the manual ritual remains the reliable path."), "deferred"),
      story("A7", c("Corte agosto–septiembre", "August–September cut"), c("Publicar 300 snapshots, 298 meses y el corte 2026-09 con regla cero.", "Publish 300 snapshots, 298 months and the 2026-09 cut under rule zero."), "done", "release/2026-09-158ec972c234"),
    ],
  },
  {
    id: "B",
    title: c("CI verde y seguridad mínima", "Green CI and minimum security"),
    summary: c(
      "Protección de main, autenticación del cron, supply chain y seguridad web.",
      "Main protection, cron authentication, supply chain and web security.",
    ),
    status: "done",
    stories: [
      story("B0", c("Publicación protegida", "Protected publishing"), c("Usar una GitHub App de alcance mínimo para publicar con gates.", "Use a least-privilege GitHub App to publish through gates."), "done"),
      story("B1", c("Supply chain mínima", "Minimum supply chain"), c("Conservar locks, contratos, triage y acciones fijadas por SHA.", "Retain locks, contracts, triage and SHA-pinned actions."), "done"),
      story("B2", c("Contratos de locks", "Lock contracts"), c("Verificar toolchain y locks dentro de los jobs vivos.", "Verify toolchain and locks inside live jobs."), "done"),
      story("B3", c("ci-gate estricto", "Strict ci-gate"), c("Exigir success de política, consistencia, lint y modelado.", "Require policy, consistency, lint and modeling success."), "done"),
      story("B4", c("Seguridad web", "Web security"), c("Reducir 17 avisos de producción a cero y documentar el triage.", "Reduce 17 production advisories to zero and document triage."), "done"),
      story("B5", c("Watchdog de fuente", "Source watchdog"), c("Distinguir fuente bloqueada de pipeline roto sin perder alertas.", "Distinguish blocked source from broken pipeline without losing alerts."), "done"),
      story("B6", c("Medición base", "Baseline measurement"), c("Medir el camino crítico real del CI sobre un SHA publicado.", "Measure the real CI critical path on a published SHA."), "done"),
    ],
  },
  {
    id: "D",
    title: c("Plataforma MLOps que paga", "MLOps platform that earns its keep"),
    summary: c(
      "Integridad del release, observabilidad y operación reproducible antes de entrenar más modelos.",
      "Release integrity, observability and reproducible operations before training more models.",
    ),
    status: "active",
    stories: [
      story("D1", c("Fricción DVC", "DVC friction"), c("Bloquear pushes cuando el lock no representa el DAG.", "Block pushes when the lock does not represent the DAG."), "done", "f67edf9"),
      story("D2", c("Advisories visibles", "Visible advisories"), c("Rechazar artefactos vacíos y convertir warnings y advisories en contratos.", "Reject empty artifacts and turn warnings and advisories into contracts."), "done", "0092af0"),
      story("D3", c("Estado de ingesta", "Ingestion state"), c("Mantener un feed cerrado, atómico y fail-closed.", "Maintain a closed, atomic and fail-closed state feed."), "done", "004e478"),
      story("D4", c("Un solo release_id", "One release_id"), c("Romper el ciclo tarjeta–manifiesto con identidad normalizada.", "Break the card–manifest cycle with normalized identity."), "done", "f9c22a2"),
      story("D5", c("Caveat provisional derivado", "Derived provisional caveat"), c("Retirarlo únicamente tras la campaña causal F2; nunca a mano.", "Remove it only after the causal F2 campaign; never by hand."), "deferred"),
      story("D6", c("Higiene de disco", "Disk hygiene"), c("Inventariar, preservar y limpiar con GC conservador y recibos.", "Inventory, preserve and clean with conservative GC and receipts."), "done"),
      story("D7", c("Tracking mensual", "Monthly tracking"), c("Observar dos rebuilds reales antes de decidir si track_run se queda.", "Observe two real rebuilds before deciding whether track_run stays."), "observing", "80b3bfb · 0/2"),
      story("D8", c("Consolidación documental", "Documentation consolidation"), c("Crear ENGINEERING.md con matriz de fuentes y backlinks, sin borrar aún.", "Create ENGINEERING.md with a source matrix and backlinks, without deleting yet."), "done", "5dd424b"),
      story("D9", c("Arquitectura MLOps", "MLOps architecture"), c("Publicar una página y un SVG del sistema completo con cifras canónicas.", "Publish a one-page system overview and SVG using canonical figures."), "done", "494bcfd"),
    ],
  },
  {
    id: "C",
    title: c("Clean code con factura", "Clean code with a measured payoff"),
    summary: c(
      "Reducir duplicación y complejidad sólo donde existe una prueba de valor.",
      "Reduce duplication and complexity only where value is demonstrated.",
    ),
    status: "planned",
    stories: [
      story("C1", c("Taxonomía única", "Single taxonomy"), c("Centralizar categorías y metadatos con golden master.", "Centralize categories and metadata with a golden master."), "done", "5fa14fa"),
      story("C2", c("Extracción común", "Shared extraction"), c("Eliminar la duplicación entre scrapers con funciones puras.", "Remove scraper duplication with pure functions."), "done", "25722fe"),
      story("C3", c("Mega-audit reejecutable", "Re-runnable mega-audit"), c("Sustituir globals mutables por un AuditReport testeable.", "Replace mutable globals with a testable AuditReport."), "done", "bb64647"),
      story("C4", c("Errores específicos", "Specific errors"), c("Eliminar silencios y registrar país y mes de cada salto.", "Remove silent failures and log country and month for every skip."), "done", "df597ff"),
      story("C5", c("Kit de figuras", "Figure kit"), c("Extraer tema, idioma y guardado común de tres generadores.", "Extract shared theme, language and saving from three generators."), "done", "68bf843"),
      story("C6", c("Base de datos modular", "Modular database build"), c("Separar migraciones, carga y gobernanza preservando el fingerprint.", "Separate migrations, loading and governance while preserving the fingerprint."), "done", "17d0ebf"),
      story("C7", c("Código muerto", "Dead code"), c("Retirar caminos sin consumidores con guardianes anti-resurrección.", "Remove consumerless paths with anti-resurrection guards."), "done", "10b100d"),
      story("C7b", c("Semántica tree-dirty", "Tree-dirty semantics"), c("Usar una sola definición comprobable de árbol sucio.", "Use one verifiable definition of a dirty tree."), "done", "10b100d"),
      story("C8", c("Tooling honesto", "Honest tooling"), c("Medir cobertura y complejidad sobre el producto real.", "Measure coverage and complexity across the real product."), "done", "309e214"),
      story("C9", c("LOC por rol", "LOC by role"), c("Impedir que tooling vuelva a superar la mitad del producto.", "Prevent tooling from again exceeding half the product."), "done", "817afc3"),
    ],
  },
  {
    id: "F",
    title: c("Sincronía total", "Full synchronization"),
    summary: c(
      "Una misma verdad canónica en datos, paper, web, RAG, tarjeta y producción.",
      "One canonical truth across data, paper, web, RAG, model card and production.",
    ),
    status: "planned",
    stories: [
      story("F1", c("Número de modelos derivado", "Derived model count"), c("Eliminar el literal web y leer key_facts fail-closed.", "Remove the web literal and read key_facts fail-closed."), "done"),
      story("F2", c("Banner de fuente", "Source banner"), c("Mostrar el bloqueo de la fuente sin prometer actualización automática.", "Show source blocking without promising automatic updates."), "observing", "17eb7a9 · activa en el próximo corte gobernado"),
      story("F3", c("Guardián generalizado", "Generalized guardian"), c("Vigilar macros, tablas, propuesta y documentación.", "Guard macros, tables, proposal and documentation."), "done", "033c8a5"),
      story("F4", c("RAG canónico", "Canonical RAG"), c("Responder cifras desde JSON y exigir un pin coherente en producción.", "Answer figures from JSON and require a coherent production pin."), "done"),
      story("F5", c("Paper derivado", "Derived paper"), c("Mover literales y caveats a facts versionados.", "Move literals and caveats into versioned facts."), "planned"),
      story("F6", c("Galería preparada", "Gallery readiness"), c("Añadir el hook de cohorte sin duplicar datos.", "Add the cohort hook without duplicating data."), "planned"),
      story("F7", c("Documentos rancios", "Stale documents"), c("Corregir conteos y afirmaciones obsoletas.", "Correct stale counts and claims."), "planned"),
      story("F8", c("Runbook de propagación", "Propagation runbook"), c("Mecanizar el orden datos → web → producción.", "Mechanize the data → web → production order."), "planned"),
    ],
  },
  {
    id: "E",
    title: c("Cohortes, DeepAR y router", "Cohorts, DeepAR and router"),
    summary: c(
      "Responder la hipótesis de estabilidad con evaluación pre-registrada y resultados positivos o negativos.",
      "Answer the stability hypothesis with preregistered evaluation and positive or negative results.",
    ),
    status: "planned",
    stories: [
      story("E0", c("Escala única", "Single scale"), c("Centralizar la escala naïve previa al entrenamiento.", "Centralize the pre-training naïve scale."), "planned"),
      story("E1", c("Cohortes causales", "Causal cohorts"), c("Construir estabilidad sin usar información del hold-out.", "Build stability without using hold-out information."), "planned"),
      story("E2", c("Scan exploratorio", "Exploratory scan"), c("Medir lo ya puntuado por cohorte sin reentrenar.", "Measure already-scored results by cohort without retraining."), "planned"),
      story("E3", c("Modelos globales", "Global models"), c("Entrenar una escalera registrada y documentar también el fracaso.", "Train a registered ladder and document failure too."), "planned"),
      story("E4", c("Router por estabilidad", "Stability router"), c("Competir contra el naïve de cada cohorte bajo el gate canónico.", "Compete against each cohort's naïve baseline under the canonical gate."), "planned"),
      story("E5", c("Propagación científica", "Scientific propagation"), c("Llevar resultados a tesis, web, RAG y tarjeta con regla cero.", "Carry results into thesis, web, RAG and model card under rule zero."), "planned"),
      story("E6", c("Limpieza pagada", "Paid-for cleanup"), c("Unificar universos y corregir catálogo y docstrings fósiles.", "Unify universes and correct stale catalog entries and docstrings."), "planned"),
    ],
  },
  {
    id: "G",
    title: c("Cierre académico", "Academic closeout"),
    summary: c(
      "Convertir la plataforma y sus resultados en tesis, paper y defensa reproducibles.",
      "Turn the platform and its results into a reproducible thesis, paper and defense.",
    ),
    status: "planned",
    stories: [
      story("G1", c("Overleaf", "Overleaf"), c("Actualizar y revisar visualmente ambos documentos.", "Update and visually review both documents."), "planned"),
      story("G2", c("Amenazas a la validez", "Threats to validity"), c("Documentar Cloudflare y la ingesta semiautomática.", "Document Cloudflare and semi-automatic ingestion."), "planned"),
      story("G3", c("Resultado de cohortes", "Cohort result"), c("Publicar la subsección aunque el resultado sea negativo.", "Publish the subsection even if the result is negative."), "planned"),
      story("G4", c("Paper MICAI", "MICAI paper"), c("Propagar corte y cohortes con caveats derivados.", "Propagate the cut and cohorts with derived caveats."), "planned"),
      story("G5", c("Deck de defensa", "Defense deck"), c("Generar cifras de la presentación desde key_facts.", "Generate presentation figures from key_facts."), "planned"),
      story("G6", c("Siguiente revisión", "Next review"), c("Llevar a Chente cohortes, multi-horizonte y decisiones abiertas.", "Bring cohorts, multi-horizon results and open decisions to Chente."), "planned"),
    ],
  },
];

export const PAUSED_TRACK = {
  id: "R9/B233",
  title: c("Entornos reproducibles content-addressed", "Content-addressed reproducible environments"),
  detail: c(
    "Preservado en 025154d con nueve entradas locales y PR #4 en draft. Gate Q lo mantiene fuera del denominador del plan activo hasta una decisión humana.",
    "Preserved at 025154d with nine local entries and PR #4 in draft. Gate Q keeps it outside the active-plan denominator until a human decision.",
  ),
  status: "paused" as const,
};

export const PLAN_UPDATES: PlanUpdate[] = [
  {
    date: "2026-09-08",
    title: c("F4 hace que el asistente lea las cifras, no las recuerde", "F4 makes the assistant read the figures instead of recalling them"),
    detail: c(
      "El asistente respondía cifras de oídas: su índice se construía solo con prosa —la página, la tarjeta del modelo, la auditoría— y nunca abría los archivos donde viven los números. Por eso una frase corregida en el sitio podía seguir contestándose vieja durante días. Ahora una tarjeta en las dos lenguas se deriva de esos archivos, con la unidad y la población al lado de cada cifra, de modo que un error de medida no se cite como si fuera universal; si falta un dato, una sección o el valor no es del tipo esperado, la construcción se detiene en vez de rellenar con prosa. Se suman cuatro documentos de ingeniería que nadie indexaba —evaluación, limpieza, promoción y el índice normativo—, traídos de la versión exacta del corte, sin resumirlos. Y cuando el sitio declara datos frescos, un índice apuntando a otro corte deja de ser una nota en consola y pasa a detener la construcción.",
      "The assistant answered figures from memory: its index was built only from prose —the page, the model card, the audit— and never opened the files where the numbers live. That is why a sentence corrected on the site could keep being answered stale for days. A card in both languages is now derived from those files, with the unit and the population next to each figure, so a measurement is not quoted as if it were universal; if a field, a section or a type is wrong, the build stops instead of filling in with prose. Four engineering documents nobody indexed join in —evaluation, cleaning, promotion and the normative index— fetched at the cut's exact version, not summarised. And when the site reports fresh data, an index pointing at a different cut stops being a console note and becomes a build failure.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("F2 retira una promesa que había dejado de ser cierta", "F2 withdraws a promise that had stopped being true"),
    detail: c(
      "El sitio prometía que la publicación de un boletín bastaba para que el panel se pusiera al día solo. Dejó de ser verdad el 6 de agosto: la fuente quedó tras un cortafuegos y los dos últimos boletines se cargaron a mano. La frase desaparece de las dos lenguas y también del corpus con el que responde el asistente, donde seguía viva palabra por palabra. En su lugar el sitio informará lo que el pipeline registra, leyéndolo del propio archivo de estado en vez de deducirlo de un texto: si el archivo falta se calla, si está y es ilegible dice que no pudo verificarlo, y nunca inventa un bloqueo. Ese archivo todavía no viaja en el corte publicado y regenerarlo cambiaría el corte que sirve producción, así que entra en el que viene y la historia queda en observación hasta entonces.",
      "The site promised that publishing a bulletin was enough for the panel to bring itself up to date. That stopped being true on 6 August: the source went behind a firewall and the last two bulletins were loaded by hand. The sentence is gone from both languages and from the corpus the assistant answers with, where it was still alive word for word. In its place the site will report what the pipeline records, reading it from the state file itself rather than inferring it from prose: if the file is missing it stays quiet, if it is present and unreadable it says it could not verify it, and it never invents a block. That file does not travel in the published cut yet, and regenerating it would change the cut production serves, so it joins the next one and the story stays under observation until then.",
    ),
    status: "observing",
  },
  {
    date: "2026-09-08",
    title: c("F1 deja de teclear cuántos modelos hay", "F1 stops typing how many models there are"),
    detail: c(
      "El número de modelos del marco comparativo era el último dato de portada escrito a mano en el sitio, con una nota que explicaba por qué: el archivo que lo lleva no se descargaba. Resultó que sí viajaba en el corte publicado, y como artefacto crítico; lo único que faltaba era consumirlo. Ahora el sitio lo lee de ahí, validando el artefacto contra su contrato antes de mirarlo, y si el archivo falta, el contrato se incumple o el valor no es un entero positivo, la construcción se detiene diciendo cuál de las tres cosas pasó. No hay respaldo: un número de portada equivocado es peor que una construcción rota. El valor servido no cambia, porque el que estaba tecleado coincidía con el del artefacto.",
      "The number of models in the comparison framework was the last headline figure typed by hand on the site, with a note explaining why: the file carrying it was not being downloaded. It turned out it did travel in the published cut, and as a critical artifact; all that was missing was consuming it. The site now reads it from there, validating the artifact against its contract before looking at it, and if the file is missing, the contract is broken or the value is not a positive integer, the build stops naming which of the three happened. There is no fallback: a wrong headline number is worse than a broken build. The served value does not change, because the typed one matched the artifact.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("C9 le pone un papel a cada archivo", "C9 gives every file a role"),
    detail: c(
      "La afirmación que abrió esta épica —que las herramientas habían llegado a pesar casi el doble que el producto— se midió a mano una tarde de agosto y nunca volvió a comprobarse. Nada en el repositorio contaba su propio tamaño. Ahora cada archivo versionado tiene exactamente un papel declarado —producto, pruebas, herramientas, experimentos, generados, y además evidencia, datos, prosa, configuración y código de terceros—, y el reparto se rompe si un archivo se queda sin papel, si dos reglas se lo disputan, si una excepción se declara dos veces o si señala a un archivo que ya no existe. Los entornos quedan fuera porque no están versionados, y eso se comprueba en lugar de suponerse. La razón entre herramientas y producto se mide en cada corrida contra el techo que fijó el autor.",
      "The claim that opened this epic —that tooling had grown to nearly twice the product— was measured by hand one afternoon in August and never checked again. Nothing in the repository counted its own size. Now every versioned file has exactly one declared role —product, tests, tooling, experiments, generated, plus evidence, data, prose, configuration and third-party code— and the split breaks if a file ends up with no role, if two rules claim it, if an exception is declared twice, or if it points at a file that no longer exists. Environments fall outside because they are not versioned, and that is checked rather than assumed. The tooling-to-product ratio is measured on every run against the ceiling the author set.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("C8 mide lo que decía medir", "C8 measures what it claimed to measure"),
    detail: c(
      "Tres reglas que el repositorio ya daba por supuestas no estaban encendidas, así que lo que el tooling afirmaba gobernar y lo que gobernaba eran cosas distintas: 133 supresiones no suprimían nada (sobre todo un orden de imports en archivos que dejaron de manipular la ruta de búsqueda), la política de capturas amplias se apoyaba en una directiva que nunca disparaba, y la complejidad no se medía en ninguna parte. Ahora se mide sobre el producto, con el umbral puesto en el máximo REAL y no en una meta inventada. Además el trinquete deja de publicar un total de supresiones que sumaba deudas de naturaleza distinta: cada regla lleva su contador, y las capturas peores (un except desnudo, un except de BaseException) dejan de ser invisibles con métricas propias. Doce salieron a la luz; el linter señalaba una.",
      "Three rules this repository already presupposed were never enabled, so what the tooling claimed to govern and what it governed were different things: 133 suppressions silenced nothing (mostly an import order in files that no longer manipulate the search path), the broad-catch policy leaned on a directive that never fired, and complexity was measured nowhere. It is now measured across the product, with the threshold set at the REAL maximum rather than an invented goal. The ratchet also stops publishing a suppression total that summed unrelated debts: each rule carries its own counter, and the worse catches (a bare except, a BaseException one) stop being invisible with metrics of their own. Twelve came to light; the linter flagged one.",
    ),
    status: "done",
  },
  {
    date: "2026-09-07",
    title: c("C7 y C7b retiran dos caminos muertos", "C7 and C7b remove two dead paths"),
    detail: c(
      "Las bandas del demostrador tenían un respaldo heredado: si faltaba el archivo de cuantilas o una celda, se estimaba con una raíz cuadrada y un escalar fijo. No era una alternativa equivalente, infra-cubría, y el consumidor no distinguía una banda medida de una estimada; ahora las cuantilas empíricas son obligatorias y una celda ausente detiene el build diciendo cuál falta. Y la pregunta «¿el árbol está sucio?» tenía tres respuestas escritas por separado: pasa a tener una sola, con el alcance restringido documentado en un sitio en vez de deducirse leyendo tres funciones.",
      "The demonstrator's bands had a legacy fallback: when the quantile file or a cell was missing, they were estimated with a square root and a fixed scalar. It was not an equivalent alternative, it under-covered, and consumers could not tell a measured band from an estimated one; the empirical quantiles are now mandatory and a missing cell stops the build naming it. And the question «is the tree dirty?» had three separately written answers: it now has one, with the narrower scope documented in a single place instead of inferred from three functions.",
    ),
    status: "done",
  },
  {
    date: "2026-09-07",
    title: c("C6 parte el almacén en tres", "C6 splits the warehouse build in three"),
    detail: c(
      "El módulo que construía el almacén hacía tres trabajos distintos en mil líneas: aplicar la cadena de migraciones, cargar y canonizar las filas, y registrar la identidad del corte. Ahora son tres módulos con una responsabilidad cada uno, y el punto de entrada y su interfaz pública quedan intactos. La huella de contenido del almacén sale idéntica con la misma identidad de build, y el Parquet byte a byte. Está en main con la integración continua en verde.",
      "The module that built the warehouse did three different jobs across a thousand lines: applying the migration chain, loading and canonicalising rows, and recording the build identity. They are now three modules with one responsibility each, with the entry point and its public surface untouched. The warehouse content fingerprint comes out identical under the same build identity, and the Parquet byte for byte. It is on main with continuous integration green.",
    ),
    status: "done",
  },
  {
    date: "2026-09-07",
    title: c("C5 extrae el kit común de figuras", "C5 extracts the shared figure kit"),
    detail: c(
      "El idioma y el tema dejan de vivir en variables globales que alguien re-vinculaba antes de cada pasada: viajan como un contexto inmutable que cada figura recibe, y los ajustes de dibujo se restauran solos aunque algo falle. Importar un generador ya no reconfigura Matplotlib para todo el proceso. Las 72 variantes de las galerías, las figuras de resultados y las 81 páginas de los reportes salen idénticas a las anteriores, y también la salida por consola y el orden en que se emiten. Está en main con la integración continua en verde.",
      "Language and theme stop living in global variables that had to be rebound before each pass: they travel as an immutable context each figure receives, and drawing settings restore themselves even when something fails. Importing a generator no longer reconfigures Matplotlib for the whole process. All 72 gallery variants, the result figures and the 81 report pages come out identical to the previous ones, and so do the console output and the order they are emitted in. It is on main with continuous integration green.",
    ),
    status: "done",
  },
  {
    date: "2026-09-06",
    title: c("C4 tipa los errores del pipeline", "C4 types the pipeline errors"),
    detail: c(
      "Las seis capturas amplias de los scrapers pasan a excepciones específicas: un fallo de la fuente o del formato se agrega al reporte mensual con etapa, mes y país, y un defecto de programación ya no se disfraza de mes perdido, sino que escapa y pone el proceso en rojo. El trinquete de deuda deja de contarse a sí mismo y baja las capturas sin justificar a cero. Está en main con la integración continua en verde.",
      "The scrapers' six broad catches become specific exceptions: a source or format failure joins the monthly report with stage, month and country, while a programming defect no longer masquerades as a lost month and instead escapes and turns the run red. The debt ratchet stops counting itself and brings unjustified catches down to zero. It is on main with continuous integration green.",
    ),
    status: "done",
  },
  {
    date: "2026-09-05",
    title: c("C3 hace reejecutable la auditoría", "C3 makes the audit re-runnable"),
    detail: c(
      "El informe deja de vivir en dos listas globales que se acumulaban entre corridas y pasa a ser un objeto por invocación. La selección de series más cortas se desempata por la clave completa con orden estable, así que ya no depende del orden de entrada. Severidades y veredicto quedan intactos.",
      "The report stops living in two module-level lists that accumulated between runs and becomes one object per invocation. The shortest-series selection now breaks ties on the full key with a stable sort, so it no longer depends on input order. Severities and verdict are unchanged.",
    ),
    status: "done",
  },
  {
    date: "2026-09-05",
    title: c("C2 unifica la extracción", "C2 unifies the extraction"),
    detail: c(
      "Los dos scrapers tenían el mismo extractor por país escrito dos veces; ahora es uno solo, parametrizado por columna y clasificador, con funciones puras probadas y salidas idénticas fila a fila sobre todo el archivo de boletines.",
      "Both scrapers carried the same per-country extractor written twice; it is now one, parameterized by column and classifier, with tested pure functions and row-for-row identical outputs across the whole bulletin archive.",
    ),
    status: "done",
  },
  {
    date: "2026-09-05",
    title: c("C1 unifica la taxonomía", "C1 unifies the taxonomy"),
    detail: c(
      "Las reglas de categoría migratoria, los dominios y la metadatos dejan de vivir en tres sitios y pasan a una autoridad única, con equivalencia probada contra los clasificadores anteriores sobre las etiquetas reales de 24 años y las salidas del pipeline byte-idénticas.",
      "Category rules, domains and metadata stop living in three places and move to a single authority, with equivalence proven against the previous classifiers over 24 years of real labels and byte-identical pipeline outputs.",
    ),
    status: "done",
  },
  {
    date: "2026-09-05",
    title: c("D8 ordena la documentación", "D8 orders the documentation"),
    detail: c(
      "Un índice normativo declara, por documento, su clase, su autoridad y sus consumidores; una prueba falla si un enlace se rompe, si dos documentos reclaman lo mismo o si falta el enlace de vuelta. Ningún documento se borró.",
      "A normative index declares each document's class, authority and consumers; a test fails on a broken link, on two documents claiming the same authority, or on a missing backlink. No document was deleted.",
    ),
    status: "done",
  },
  {
    date: "2026-09-04",
    title: c("D9 dibuja la arquitectura", "D9 draws the architecture"),
    detail: c(
      "Una página y un SVG generados desde las fuentes canónicas explican el DAG, el cron, campeón y sombra, los gates, la deriva, el guardián y el manifiesto; el guardián vigila ahora también el diagrama.",
      "A page and an SVG generated from canonical sources explain the DAG, the cron, champion and shadow, the gates, drift, the guard and the manifest; the guard now watches the diagram too.",
    ),
    status: "done",
  },
  {
    date: "2026-09-04",
    title: c("D7 llegó a main", "D7 reached main"),
    detail: c("Tracking mensual mergeado con CI 5/5; comienza la observación de dos rebuilds reales (0/2).", "Monthly tracking merged with 5/5 CI; observation over two real rebuilds begins (0/2)."),
    status: "observing",
  },
  {
    date: "2026-09-04",
    title: c("D4 cerró el ciclo de identidad", "D4 closed the identity cycle"),
    detail: c("El contrato de release_id único está en main y se activará con el próximo boletín real.", "The single release_id contract is on main and will activate with the next real bulletin."),
    status: "done",
  },
  {
    date: "2026-09-04",
    title: c("D2 completo", "D2 complete"),
    detail: c("Artefactos vacíos, advisories y warnings quedaron bajo contratos visibles y CI verde.", "Empty artifacts, advisories and warnings are now covered by visible contracts and green CI."),
    status: "done",
  },
  {
    date: "2026-09-03",
    title: c("D1 y B4 completos", "D1 and B4 complete"),
    detail: c("El hook DVC bloquea locks rancios y la auditoría web registra cero vulnerabilidades.", "The DVC hook blocks stale locks and the web audit records zero vulnerabilities."),
    status: "done",
  },
  {
    date: "2026-09-02",
    title: c("Higiene 100/100", "Cleanup 100/100"),
    detail: c("Repositorios, plataforma, evidencia y recuperación quedaron verificados sin perder trabajo.", "Repositories, platform, evidence and recovery were verified without losing work."),
    status: "done",
  },
  {
    date: "2026-09-01",
    title: c("Corte 2026-09 publicado", "2026-09 cut published"),
    detail: c(
      "Producción fue verificada como fresh, con el archivo de instantáneas, los meses del panel y el release inmutable alineados.",
      "Production was verified as fresh, with the snapshot archive, the panel months and the immutable release all aligned.",
    ),
    status: "done",
  },
];

export const STATUS_WEIGHT: Record<PlanStatus, number> = {
  done: 1,
  observing: 0.75,
  active: 0.5,
  planned: 0,
  deferred: 0,
  paused: 0,
};

/**
 * Agrupa la bitácora por día sin mutar el feed ni reordenar los avances dentro de
 * una misma fecha. Los días sí salen del más reciente al más antiguo aunque el
 * llamador entregue el feed desordenado.
 */
export function groupUpdatesByDay(updates: PlanUpdate[] = PLAN_UPDATES): PlanDay[] {
  const byDate = new Map<string, PlanUpdate[]>();
  for (const update of updates) {
    const day = byDate.get(update.date);
    if (day) day.push(update);
    else byDate.set(update.date, [update]);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dailyUpdates]) => ({ date, updates: dailyUpdates }));
}

export function planStats(epics = PLAN_EPICS) {
  const stories = epics.flatMap((epic) => epic.stories);
  const completed = stories.filter((item) => item.status === "done").length;
  const advanced = stories.filter((item) =>
    ["done", "observing", "active"].includes(item.status),
  ).length;
  const points = stories.reduce((sum, item) => sum + STATUS_WEIGHT[item.status], 0);
  return {
    total: stories.length,
    completed,
    advanced,
    observing: stories.filter((item) => item.status === "observing").length,
    deferred: stories.filter((item) => item.status === "deferred").length,
    planned: stories.filter((item) => item.status === "planned").length,
    percent: Math.round((points / stories.length) * 100),
  };
}

export function epicStats(epic: PlanEpic) {
  const total = epic.stories.length;
  const completed = epic.stories.filter((item) => item.status === "done").length;
  const points = epic.stories.reduce((sum, item) => sum + STATUS_WEIGHT[item.status], 0);
  return { total, completed, percent: Math.round((points / total) * 100) };
}

export type PlanFocus = {
  /** Épica que contiene la siguiente historia accionable; es la fase en curso. */
  epic: PlanEpic;
  /** La historia en la que se trabaja ahora: la que está en curso, o la primera sin empezar. */
  next: PlanStory | null;
  /** Historias entregadas que siguen bajo observación operacional. */
  observing: PlanStory[];
  /** Historias diferidas a una fase posterior. */
  deferred: PlanStory[];
  /** Fecha real más reciente del feed, no una constante que haya que recordar mover. */
  updatedAt: string;
};

/**
 * Deriva del propio plan lo que la cabecera anuncia. Todo lo que aquí se calcula solía estar
 * cableado en el componente, y por eso el tablero siguió prometiendo épicas ya entregadas.
 *
 * Es una función pura: recibe el plan y el feed, no lee estado global, y no muta sus argumentos.
 */
export function planFocus(
  epics: PlanEpic[] = PLAN_EPICS,
  updates: PlanUpdate[] = PLAN_UPDATES,
): PlanFocus {
  const stories = epics.flatMap((epic) => epic.stories);
  // «Accionable» es la historia en curso si la hay, y si no la primera sin empezar: mientras
  // algo está activo, ESO es lo siguiente, no lo que viene después. Lo diferido y lo pausado
  // esperan otra decisión, así que no encabezan el plan aunque aparezcan antes en el orden.
  const next =
    stories.find((item) => item.status === "active") ??
    stories.find((item) => item.status === "planned") ??
    null;
  const epic =
    (next && epics.find((item) => item.stories.some((story) => story.id === next.id))) ??
    epics[epics.length - 1];
  const dates = updates.map((item) => item.date).sort();
  return {
    epic,
    next,
    observing: stories.filter((item) => item.status === "observing"),
    deferred: stories.filter((item) => item.status === "deferred"),
    updatedAt: dates[dates.length - 1] ?? "",
  };
}

export const copy = (value: Copy, lang: Lang) => value[lang];
