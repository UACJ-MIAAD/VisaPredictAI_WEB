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
  dataMain: "a8029f2266faf73ef5e0b5fbd8c1386b50c3cb7d",
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
      story("F5", c("Paper derivado", "Derived paper"), c("Mover literales y caveats a facts versionados.", "Move literals and caveats into versioned facts."), "observing", "7925dae · reglas puestas; los facts esperan la campaña causal"),
      story("F6", c("Galería preparada", "Gallery readiness"), c("Añadir el hook de cohorte sin duplicar datos.", "Add the cohort hook without duplicating data."), "done"),
      story("F7", c("Documentos rancios", "Stale documents"), c("Corregir conteos y afirmaciones obsoletas.", "Correct stale counts and claims."), "done", "1c81b6f"),
      story("F8", c("Runbook de propagación", "Propagation runbook"), c("Mecanizar el orden datos → web → producción.", "Mechanize the data → web → production order."), "done", "1c81b6f"),
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
      story("E0", c("Escala única", "Single scale"), c("Centralizar la escala naïve previa al entrenamiento.", "Centralize the pre-training naïve scale."), "done", "816d088"),
      story("E1", c("Cohortes causales", "Causal cohorts"), c("Construir estabilidad sin usar información del hold-out.", "Build stability without using hold-out information."), "done", "967dfcb"),
      story("E2", c("Scan exploratorio", "Exploratory scan"), c("Medir lo ya puntuado por cohorte sin reentrenar.", "Measure already-scored results by cohort without retraining."), "done", "e8b4629"),
      story("E3", c("Modelos globales", "Global models"), c("Entrenar una escalera registrada y documentar también el fracaso.", "Train a registered ladder and document failure too."), "done", "850d4bd"),
      story("E4", c("Router por estabilidad", "Stability router"), c("Competir contra el naïve de cada cohorte bajo el gate canónico.", "Compete against each cohort's naïve baseline under the canonical gate."), "done", "2ff4d07"),
      story("E5", c("Propagación científica", "Scientific propagation"), c("Llevar resultados a tesis, web, RAG y tarjeta con regla cero.", "Carry results into thesis, web, RAG and model card under rule zero."), "observing", "a53202e"),
      story("E6", c("Limpieza pagada", "Paid-for cleanup"), c("Unificar universos y corregir catálogo y docstrings fósiles.", "Unify universes and correct stale catalog entries and docstrings."), "done", "51a83ff"),
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
      story("G1", c("Overleaf", "Overleaf"), c("Compilar y revisar los tres documentos oficiales desde el repositorio documental.", "Compile and review the three official documents from the documentary repository."), "done"),
      story("G2", c("Amenazas a la validez", "Threats to validity"), c("Documentar el bloqueo de la fuente y la ingesta semiautomática, y retirar la promesa de operación desatendida.", "Document the blocked source and the semi-automatic ingestion, and retire the unattended-operation claim."), "done", "29ca6cb"),
      story("G3", c("Resultado de cohortes", "Cohort result"), c("Publicar la subsección aunque el resultado sea negativo.", "Publish the subsection even if the result is negative."), "done", "a53202e"),
      story("G4", c("Paper MICAI", "MICAI paper"), c("Propagar corte y cohortes con caveats derivados.", "Propagate the cut and cohorts with derived caveats."), "observing", "a8029f2 · corte y cohortes propagados; el descargo espera la re-derivación causal"),
      story("G5", c("Deck de defensa", "Defense deck"), c("Generar las cifras de la presentación desde los artefactos sellados, con procedencia y pruebas anti-deriva.", "Generate the presentation figures from the sealed artifacts, with provenance and anti-drift tests."), "done"),
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
    date: "2026-09-10",
    title: c(
      "G5 deja el material de la defensa generado desde los datos, no escrito a mano",
      "G5 leaves the defense material generated from the data, not written by hand",
    ),
    detail: c(
      "Una presentación es el sitio donde las cifras envejecen sin que nadie se entere: se copian una vez y nadie vuelve a comprobarlas. El material de la defensa se construye ahora con un programa que lee los archivos sellados del proyecto y arma las láminas con lo que encuentre; si un dato que una lámina necesita no existe, el programa se detiene y lo dice por su nombre, en vez de dejar un hueco o inventar una cifra. Cada número aparece acompañado de su unidad y de la población a la que se refiere, y la última lámina lista las huellas digitales de los archivos de los que salió todo. Un conjunto de comprobaciones automáticas vigila que no se despegue: fallan si alguna cifra visible no viene de un archivo, si el material guardado no coincide con lo que el programa produce hoy, si alguno de los archivos cambió desde la última construcción, o si alguna de las afirmaciones cualitativas dejó de ser cierta. El contenido cubre el panel, el piso difícil de batir, el valor a varios meses, el resultado negativo de las cohortes, la amenaza de disponibilidad de la fuente y las decisiones que siguen abiertas. El material es privado y de uso interno: no se publica en este sitio ni se incorpora a ningún repositorio del proyecto.",
      "A presentation is where figures age unnoticed: they are copied once and nobody checks them again. The defense material is now built by a program that reads the project's sealed files and assembles the slides from whatever it finds; if a fact a slide needs does not exist, the program stops and names it, instead of leaving a gap or inventing a number. Every figure appears with its unit and the population it refers to, and the last slide lists the fingerprints of the files everything came from. A set of automated checks watches for drift: they fail if a visible figure does not come from a file, if the stored material does not match what the program produces today, if any of those files changed since the last build, or if one of the qualitative claims stopped being true. The content covers the panel, the floor that is hard to beat, the value at several months out, the negative cohort result, the availability threat to the source and the decisions still open. The material is private and for internal use: it is not published on this site nor added to any repository of the project.",
    ),
    status: "done",
  },
  {
    date: "2026-09-10",
    title: c(
      "G4 lleva al artículo el resultado de las cohortes y la amenaza al suministro, y queda en observación",
      "G4 carries the cohort result and the supply threat into the paper, and stays under observation",
    ),
    detail: c(
      "El artículo defiende un hallazgo incómodo: en este panel, repetir el último valor publicado es difícil de batir, y ningún modelo entrenado lo consigue con significancia. La objeción natural es que ese piso sea un efecto de mezclar series muy distintas. La respuesta ya estaba medida y ahora se publica: se partió el panel en series estables e inestables con una regla escrita antes de mirar ningún resultado, se entrenó cada grupo por separado y se exigió al selector por grupo el mismo listón que al sistema, en tres plazos a la vez. No lo pasa ninguno, ni en una tabla ni en la otra, y en uno de los grupos el propio selector elige el método simple, de modo que compite consigo mismo. Segmentar, por sí solo, no cambia quién gana a un mes. El párrafo no lleva ni una cifra: la afirmación es cualitativa porque el hallazgo lo es, y los números viven en la tesis, derivados de los archivos sellados. Se añade además la limitación de suministro: la fuente oficial rechaza visitas automatizadas, así que la descarga mensual se hace a mano y entra por el mismo procedimiento controlado; eso amenaza la puntualidad, no la integridad de lo ya recogido. La historia queda en observación y no terminada, porque las cifras principales del artículo siguen esperando la re-derivación causal, y el descargo que lo advierte sólo puede retirarse cuando esa medición exista.",
      "The paper defends an uncomfortable finding: on this panel, repeating the last published value is hard to beat, and no trained model beats it with significance. The natural objection is that such a floor is an effect of pooling very different series. The answer had already been measured and is now published: the panel was split into stable and unstable series under a rule written before any result was inspected, each group was trained separately, and the per-group selector had to clear the same bar as the system, at three horizons at once. None clears it, in either table, and in one group the selector picks the simple method itself, so it competes with its own reference. Segmenting, on its own, does not change who wins at one month. The paragraph carries no figure at all: the claim is qualitative because the finding is, and the numbers live in the thesis, derived from the sealed files. The supply limitation is added too: the official source rejects automated visits, so the monthly download is done by hand and enters through the same controlled procedure; that threatens timeliness, not the integrity of what has already been collected. The story stays under observation rather than finished, because the paper's headline figures are still waiting on the causal re-derivation, and the disclaimer that says so may only be retired once that measurement exists.",
    ),
    status: "observing",
  },
  {
    date: "2026-09-10",
    title: c(
      "G2 documenta lo que el bloqueo de la fuente sí amenaza, y retira una promesa que había dejado de ser cierta",
      "G2 documents what the blocked source actually threatens, and retires a claim that had stopped being true",
    ),
    detail: c(
      "El sitio oficial que publica los boletines dejó de aceptar visitas automatizadas, así que los últimos meses se descargaron a mano y entraron por la misma orden controlada de siempre. Al revisar la tesis para escribir esa limitación apareció algo más urgente: un apéndice seguía afirmando que el sistema se mantiene al día sin intervención manual, y eso había dejado de ser verdad. La frase se retira y se sustituye por lo que sí se sostiene. El texto nuevo hace una distinción que importa: lo que está en riesgo es la frescura, es decir, la puntualidad con que llega cada mes nuevo y, con ella, la acumulación de evidencia para juzgar los pronósticos a plazos largos; lo que no está en riesgo es la integridad de lo ya recogido, porque cada página quedó congelada, verificada y respaldada, y el corte actual no tiene ningún mes ausente. Cambia quién trae la página, no cómo se valida ni cómo se guarda. Para que la afirmación retirada no vuelva por descuido, una comprobación automática la vigila ahora en todos los documentos del proyecto, no sólo en el sitio, y distingue prometer automatismo de describir el trabajo manual, que sigue siendo legítimo. El estado concreto de la fuente no se copia en ningún documento: se publica en el archivo que viaja con cada corte, de modo que cuando cambie, cambie en un solo lugar.",
      "The official site that publishes the bulletins stopped accepting automated visits, so the last months were downloaded by hand and entered through the same controlled command as always. Reviewing the thesis to write that limitation turned up something more pressing: an appendix still claimed the system stays up to date without manual intervention, and that had stopped being true. The sentence is retired and replaced by what does hold. The new text draws a distinction that matters: what is at risk is freshness, that is, how promptly each new month arrives and, with it, the build-up of evidence for judging long-range forecasts; what is not at risk is the integrity of what has already been collected, because every page was frozen, verified and backed up, and the current cut has no missing month. What changes is who fetches the page, not how it is validated or stored. So the retired claim cannot creep back, an automated check now watches for it across every document of the project, not just the site, and it tells promising automation apart from describing manual work, which remains legitimate. The concrete state of the source is copied into no document: it is published in the file that travels with every cut, so that when it changes, it changes in one place only.",
    ),
    status: "done",
  },
  {
    date: "2026-09-10",
    title: c(
      "G1 lleva los documentos a su propia casa y vuelve a compilarlos de punta a punta",
      "G1 moves the documents into their own home and compiles them end to end again",
    ),
    detail: c(
      "La tesis, el anteproyecto y el artículo vivían dentro del repositorio de datos, mezclados con el código que produce los números. Ahora tienen un repositorio propio, con su propia comprobación automática: cada vez que alguien toca un texto, el sistema los compila los tres y avisa si alguno deja de armarse. Al separarlos se comprobó archivo por archivo que ninguno cambiara ni un byte por el camino. En el repositorio de datos quedan sólo las cinco tablas de cifras que genera el propio pipeline, y una comprobación exige que sean idénticas en los dos lados, para que nadie edite una copia y deje la otra atrás. Con la mudanza hecha, los tres documentos se compilaron y revisaron en la herramienta de edición que usa el autor, sin un solo error. Desde ahora esa herramienta se usa para compilar y mirar el resultado, no para guardar cambios: lo que deba perdurar entra por el repositorio, con su revisión, y desde allí se trae. Es la misma disciplina que ya rige el código, aplicada al texto.",
      "The thesis, the proposal and the paper used to live inside the data repository, mixed in with the code that produces the numbers. They now have a repository of their own, with its own automated check: whenever someone edits a text, the system compiles all three and says so if any of them stops building. The move was verified file by file, so that not one byte changed along the way. The data repository keeps only the five tables of figures the pipeline itself generates, and a check demands they be identical on both sides, so nobody edits one copy and leaves the other behind. With the move done, the three documents were compiled and reviewed in the author's editing tool, without a single error. From now on that tool is used to compile and look at the result, not to store changes: whatever should last enters through the repository, with its review, and is pulled from there. It is the same discipline that already governs the code, applied to the text.",
    ),
    status: "done",
  },
  {
    date: "2026-09-09",
    title: c("E6 pone una sola autoridad y retira lo que ya no era cierto", "E6 sets one authority and retires what had stopped being true")
    ,
    detail: c(
      "El primer hallazgo fue tranquilizador y conviene decirlo tal cual: las seis maneras en que el sistema decidía qué series entran al análisis daban exactamente el mismo resultado, las mismas setenta y cuatro. No había ninguna discrepancia escondida. Lo que sí había era la posibilidad de que se separaran algún día sin que nadie lo notara, y algunos números escritos a mano que lo habrían tapado; ahora hay una sola autoridad que lo calcula y una comprobación que, si alguna copia se desvía, dice cuál y en qué. Después vinieron tres correcciones de cosas que habían dejado de ser verdad. Un modelo estaba archivado como «no funciona aquí» por una razón que el paso anterior desmintió al medirlo bien; vuelve a la categoría de evaluado, sin entrar por eso al ciclo de producción ni acercarse al despliegue. Un modelo híbrido no produce ningún resultado en una de las dos tablas, y eso queda escrito como limitación observada, con la fuente y el alcance exactos, sin rellenar el hueco ni borrar la fila. Y tres comentarios del código afirmaban que cierto método gana a plazos largos cuando el propio archivo de medición del repositorio dice que gana otro; la afirmación se retira y se apunta a donde se mide, en vez de cambiarla por un nombre nuevo que volvería a envejecer.",
      "The first finding was reassuring and worth stating plainly: the six ways the system decided which series enter the analysis all gave exactly the same result, the same seventy-four. There was no hidden discrepancy. What there was, was the possibility of them drifting apart one day without anyone noticing, and a few hand-written numbers that would have masked it; there is now a single authority that computes it and a check that, if any copy strays, says which one and by what. Then came three corrections of things that had stopped being true. One model was shelved as «does not work here» for a reason the previous step disproved by measuring it properly; it returns to the evaluated category, without thereby entering the production cycle or getting near deployment. A hybrid model produces no result at all on one of the two tables, and that is written down as an observed limitation, with its exact source and scope, without filling the gap or deleting the row. And three code comments claimed a certain method wins at long horizons when the repository's own measurement file says another one does; the claim is retired and points at where it is measured, rather than being swapped for a new name that would age just the same.",
    ),
    status: "done",
  },
  {
    date: "2026-09-09",
    title: c("E5 hace que todas las cifras de la épica salgan de un solo archivo", "E5 makes every figure in the epic come from a single file"),
    detail: c(
      "Cuando un mismo número vive en la tesis, en una tabla, en una figura, en la ficha del modelo y en el sitio, tarde o temprano cuatro de esos cinco quedan desactualizados y nadie lo nota. Aquí se cerró esa puerta: hay un solo archivo con las cifras de toda la etapa, derivado de los cuatro pasos anteriores, y todo lo demás se genera desde él. Ni un conteo, ni un promedio, ni un veredicto se copia a mano, y una comprobación automática recorre el texto nuevo de la tesis y falla si encuentra un número escrito a pulso. La redacción conserva el resultado como salió, que sigue siendo negativo: ningún enrutador gana; en una tabla las mejoras a seis y doce meses no bastan porque a tres no llegan; en otra la mejora grande a doce meses no salva a la celda, que pierde a tres; y el grupo más pequeño no aporta evidencia. El sitio y el asistente quedan preparados para mostrar estas cifras, pero solo cuando viajen selladas en un corte: el corte actual no las trae y, por regla, no se muestra nada en vez de inventar una cohorte. El corte publicado no se regeneró; los archivos nuevos entran al contrato de los cortes futuros con una excepción cerrada y nominal para el actual.",
      "When the same number lives in the thesis, in a table, in a figure, in the model card and on the site, sooner or later four of those five go stale and nobody notices. That door is now closed: there is a single file holding the figures for the whole stage, derived from the four previous steps, and everything else is generated from it. Not one count, not one average, not one verdict is copied by hand, and an automatic check walks the new thesis text and fails if it finds a number written by hand. The wording keeps the result as it came out, which is still negative: no router wins; in one table the six- and twelve-month gains are not enough because the three-month one falls short; in another the large twelve-month gain does not save the cell, which loses at three; and the smallest group provides no evidence. The site and the assistant are ready to show these figures, but only once they travel sealed in a cut: the current cut does not carry them and, by rule, nothing is shown rather than inventing a cohort. The published cut was not regenerated; the new files enter the contract for future cuts with a closed, named exception for the current one.",
    ),
    status: "observing",
  },
  {
    date: "2026-09-09",
    title: c("E4 pone a competir el enrutado por grupos, y corrige una frase de más", "E4 puts group routing to the test, and takes back a sentence"),
    detail: c(
      "Primero la corrección, porque toca algo ya publicado. Al contar el paso anterior escribí que cambiar la forma de medir el error y de escalar los datos era la causa de que la configuración vieja se descontrolara. No se puede afirmar eso: entre las dos configuraciones comparadas cambian varias cosas a la vez, así que lo demostrado es el paquete completo, no ninguna de sus piezas. Y al separarlo con cuidado el cuadro es distinto: lo que ayuda siempre es entrenar sobre el cambio mes a mes; el resto del paquete ayuda en una de las dos tablas y estorba en la otra. La frase queda corregida aquí y en los registros internos. Lo nuevo: se probó un enrutador que, para cada grupo de series y cada distancia de pronóstico, usa el método que mejor se portó en el pasado y se juzga solo con meses que nunca vio. Las condiciones para declararlo ganador estaban escritas desde julio y no se tocaron: mejorar por un margen mínimo, aguantar una prueba estadística exigente y no empeorar en ninguna de las tres distancias. Ninguno de los cuatro grupos las cumple. En una tabla el enrutador mejora bastante a seis y doce meses, pero no lo bastante a tres; en otra mejora mucho a doce meses y aun así queda descalificado por empeorar a tres. Y en el grupo más pequeño el propio enrutador elige el método simple, con lo que se compara consigo mismo. El resultado negativo cierra el paso, y el enrutador no se despliega: eso pediría una prueba en vivo y un permiso aparte.",
      "The correction first, because it touches something already published. Reporting the previous step I wrote that changing how error is measured and how data is scaled was the cause of the old configuration spiralling. That cannot be claimed: several things change at once between the two configurations compared, so what is demonstrated is the whole bundle, not any of its pieces. And separating it carefully gives a different picture: what always helps is training on the month-to-month change; the rest of the bundle helps in one of the two tables and hurts in the other. The sentence is corrected here and in the internal records. What is new: a router was tested that, for each group of series and each forecast distance, uses whichever method did best in the past and is judged only on months it never saw. The conditions for calling it a winner were written back in July and were not touched: improve by a minimum margin, survive a demanding statistical test, and not get worse at any of the three distances. None of the four groups meets them. In one table the router improves considerably at six and twelve months, but not enough at three; in another it improves a lot at twelve months and is still disqualified for getting worse at three. And in the smallest group the router picks the simple method itself, so it ends up compared against itself. The negative result closes the step, and the router is not deployed: that would need a live trial and separate permission.",
    ),
    status: "done",
  },
  {
    date: "2026-09-09",
    title: c("E3 entrena de verdad, apunta antes de disparar, y falla", "E3 actually trains, calls its shot first, and fails"),
    detail: c(
      "El paso anterior había mirado resultados viejos; este entrena. Antes de encender nada se escribió y se guardó qué se iba a probar: tres recetas y ni una más, con todos sus ajustes fijados, más una lista de modelos de contexto que no pueden ascender a respuesta después. El programa no acepta una receta que no esté en esa lista, así que cambiar de idea a mitad deja huella. Corrieron cuarenta y dos entrenamientos en el procesador de una computadora portátil, sin tarjeta gráfica, cada uno con un recibo que dice qué se corrió, con qué materiales, cuánto tardó, cuánta memoria usó y qué archivos dejó. Los cuarenta y dos terminaron. Ninguno le gana al método de repetir el último valor conocido dentro de su propio grupo. Dos cosas sí quedaron aclaradas, y quedaron porque se apuntó antes: la configuración vieja, que en julio se descontrolaba hasta dar errores diez veces peores, sí se controla cambiándole varias cosas a la vez; y entrenar sobre el cambio mes a mes, en vez de sobre el nivel, importa por sí solo, a veces al doble. Arreglar el descontrol no basta para ganar. El resultado negativo se publica igual, porque un experimento que solo se cuenta cuando sale bien no es un experimento.",
      "The previous step looked at old results; this one trains. Before switching anything on, what would be tried was written down and saved: three recipes and not one more, with every setting fixed, plus a list of context models that cannot be promoted to answers afterwards. The program refuses a recipe that is not on that list, so changing your mind halfway leaves a trace. Forty-two training runs went through a laptop processor, with no graphics card, each leaving a receipt saying what ran, on what material, how long it took, how much memory it used and which files it wrote. All forty-two finished. None beats the method of repeating the last known value within its own group. Two things did get settled, and they got settled because the shot was called first: the old configuration, which back in July spiralled into errors ten times worse, does come under control when several things are changed together; and training on the month-to-month change rather than the level matters on its own, sometimes by a factor of two. Fixing the spiral is not enough to win. The negative result is published all the same, because an experiment you only report when it goes your way is not an experiment.",
    ),
    status: "done",
  },
  {
    date: "2026-09-09",
    title: c("E2 pregunta si separar las series sirve de algo, y la respuesta es que no", "E2 asks whether splitting the series helps at all, and the answer is no"),
    detail: c(
      "Con las series ya separadas en estables e inestables, tocaba la pregunta barata: entre los modelos que ya se habían evaluado, ¿alguno le gana al método más tonto posible —repetir el último valor conocido— dentro de su propio grupo? La comparación se hizo grupo por grupo y contra el método tonto de ESE grupo, nunca contra un promedio de todos: el listón de un grupo que apenas se mueve y el de uno que avanza cada mes son números distintos, y compararse contra la media de los dos es no compararse contra nada. Las reglas del contraste se escribieron antes de mirar ningún número, y se comprobaron enumerando a mano todos los casos posibles en muestras pequeñas. De sesenta y ocho comparaciones concluyentes, sesenta y ocho salieron peor que el método tonto y ninguna mejor. Un cuarto grupo tiene solo cinco series, demasiado pocas para que la prueba pueda decir nada, y así queda escrito en vez de forzar una conclusión. También se publica un detalle incómodo: en uno de los grupos, un modelo es idéntico al método tonto hasta la novena cifra decimal, y la prueba lo declara significativamente peor porque solo mira el sentido de la diferencia, no su tamaño; el veredicto se deja como estaba y se publica al lado de qué tamaño tiene realmente esa diferencia. El resultado es negativo y se conserva: separar por estabilidad, por sí solo y a un mes de distancia, no cambia quién gana.",
      "With the series already split into stable and unstable, the cheap question came next: among the models already evaluated, does any of them beat the dumbest possible method —repeating the last known value— within its own group? The comparison was done group by group and against THAT group's dumb method, never against an average over all of them: the bar for a group that barely moves and one that advances every month are different numbers, and comparing against the average of the two is comparing against nothing. The rules of the contrast were written before looking at any number, and were checked by enumerating every possible case by hand on small samples. Of sixty-eight conclusive comparisons, sixty-eight came out worse than the dumb method and none better. A fourth group has only five series, too few for the test to say anything, and that is written down rather than forced into a conclusion. One uncomfortable detail is also published: in one group a model is identical to the dumb method down to the ninth decimal, and the test declares it significantly worse because it only looks at the direction of the difference, not its size; the verdict is left as it stood and published alongside how big that difference actually is. The result is negative and it is kept: splitting by stability, on its own and one month ahead, does not change who wins.",
    ),
    status: "done",
  },
  {
    date: "2026-09-09",
    title: c("E1 separa series estables de inestables sin mirar el futuro", "E1 separates stable from unstable series without looking at the future"),
    detail: c(
      "El director pidió entrenar por separado las series estables y las que no lo son. El riesgo de hacerlo mal es sutil: si para decidir qué serie es estable se mira el tramo final que después se usa para evaluar, cualquier ventaja posterior está comprada de antemano. Aquí la partición se calcula únicamente con lo anterior a ese tramo, y la prueba que lo garantiza sustituye el tramo final entero por basura de cuatro maneras distintas y exige que ni una sola medida ni una sola etiqueta se muevan. La regla quedó escrita y congelada antes de mirar ningún resultado, y es deliberadamente pobre: dos condiciones sobre la frecuencia y el tamaño de los retrocesos. Había una trampa medida en agosto: llamar estables a las series sin retrocesos elegía veintitrés que están quietas más de la mitad del tiempo, y una serie quieta es fácil de predecir por definición. Por eso la quietud no decide nada y viaja como anotación aparte: de las treinta y nueve estables, veintiocho están quietas y once avanzan de verdad. También se dice lo que no luce: el segundo umbral no descarta hoy ninguna serie por sí solo. Nada de esto es todavía una conclusión: es la preparación, registrada por escrito para que la comparación que viene después no pueda acomodarse al resultado.",
      "The director asked for stable and unstable series to be trained separately. The subtle risk is this: if deciding which series is stable involves looking at the final stretch later used for evaluation, any advantage found afterwards was bought in advance. Here the split is computed only from what precedes that stretch, and the test guaranteeing it replaces the entire final stretch with garbage in four different ways and demands that not one measure and not one label move. The rule was written down and frozen before looking at any result, and it is deliberately poor: two conditions on how often and how large the backward jumps are. There was a trap measured in August: calling series without backward jumps stable picked twenty-three that sit still more than half the time, and a series that sits still is easy to predict by definition. So stillness decides nothing and travels as a separate annotation: of the thirty-nine stable ones, twenty-eight sit still and eleven genuinely advance. What does not flatter is also stated: the second threshold today rules out no series on its own. None of this is a conclusion yet: it is the preparation, put on the record so the comparison that follows cannot be fitted to its own result.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("E0 deja una sola escala para el MASE, y dos copias dejan de mentir", "E0 leaves a single MASE scale, and two copies stop lying"),
    detail: c(
      "El número por el que se divide todo error para volverlo comparable entre series vivía copiado en cuatro sitios. Tres coincidían; dos de ellos, los que puntúan a los modelos fundacionales, hacían algo distinto cuando la serie no daba para calcularlo: en vez de admitir que la escala no existe, devolvían un uno. Dividir por uno no falla, no avisa y deja un número que parece una métrica comparable cuando en realidad son días, mil veces más grande, contaminando cualquier promedio que lo incluya. Antes de tocar nada se midieron las cuatro sobre once series: en las seis que sí tienen escala coinciden hasta el último decimal, y en las cinco que no, dos mentían. Ahora hay una sola implementación, no depende de las bibliotecas de modelado, y las dos que mentían excluyen esa serie en lugar de inventarle un número. De paso, un periodo estacional imposible dejó de calcularse en silencio y ahora se rechaza, y la prueba de la que cuelga toda cifra de precisión publicada —que hasta hoy se saltaba entera cuando faltaban esas bibliotecas— por fin se ejecuta.",
      "The number every error is divided by to make it comparable across series lived copied in four places. Three agreed; two of them, the ones scoring the foundation models, did something different when a series was too degenerate to compute it: instead of admitting the scale does not exist, they returned a one. Dividing by one does not fail, does not warn, and leaves a number that looks like a comparable metric when it is really days, a thousand times larger, contaminating any average that includes it. Before touching anything the four were measured over eleven series: on the six that do have a scale they agree to the last decimal, and on the five that do not, two were lying. There is now a single implementation, it does not depend on the modelling libraries, and the two that lied exclude that series instead of inventing a number for it. Along the way, an impossible seasonal period stopped being computed in silence and is now rejected, and the test on which every published accuracy figure hangs —which until today was skipped entirely when those libraries were missing— finally runs.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("F7 y F8 limpian la documentación y fijan el orden de publicación", "F7 and F8 clean the documentation and fix the publication order"),
    detail: c(
      "Varias páginas de documentación seguían contando boletines en prosa, un número que cambia con cada corte y ya había cambiado; ahora dicen lo que quieren decir sin el conteo, que vive donde se genera. El documento que explica el guardián ilustraba su tolerancia tipográfica con una cifra muerta y describía cuatro clases de regla cuando hay siete. Las entradas fechadas de los registros se dejan como están: son historia, no afirmaciones. Y el orden de publicación —primero los datos, después el sitio, después producción— deja de ser costumbre: queda escrito con sus precondiciones, sus condiciones de parada, cómo se verifica cada etapa y cómo se deshace, y una orden de solo lectura lo comprueba antes de mover nada. Bloquea si algún árbol está sucio, si un artefacto crítico falta o fue manipulado, si el sitio declara un corte distinto del publicado o si va por delante de los datos; que el repositorio del sitio no esté disponible es un fallo, no un permiso.",
      "Several documentation pages still counted bulletins in prose, a number that changes with every cut and had already changed; they now say what they mean without the count, which lives where it is generated. The document explaining the guard illustrated its typographic tolerance with a dead figure and described four kinds of rule when there are seven. The dated log entries are left as they are: they are history, not claims. And the publication order —data first, then the site, then production— stops being a habit: it is written down with its preconditions, stopping conditions, how each stage is verified and how it is undone, and a read-only command checks it before anything moves. It blocks if either tree is dirty, if a critical artifact is missing or tampered with, if the site declares a different cut than the published one, or if it runs ahead of the data; the site repository being unavailable is a failure, not a permission.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("F6 deja listo el gancho de cohorte, sin inventarla", "F6 leaves the cohort hook ready, without inventing one"),
    detail: c(
      "La dirección de la tesis pide partir el panel en series estables y no estables y entrenar cada grupo por su lado. Eso llegará como un campo del corte publicado, y hoy ese campo no existe en ninguna de las series. Así que se deja el gancho puesto y nada más: si el corte declara la cohorte de una serie, la galería la muestra tal cual la diga el archivo; mientras no la declare, la interfaz queda exactamente como está, sin una sola insignia. Un valor vacío, de otro tipo o con una estructura ambigua tampoco pinta nada: una etiqueta inventada sería peor que ninguna. La insignia lee el mismo dato que la tarjeta ya tiene, sin descargar nada aparte, y conserva los enlaces profundos, el orden y el modo compacto.",
      "The thesis direction asks to split the panel into stable and unstable series and train each group separately. That will arrive as a field of the published cut, and today no series carries it. So the hook is left in place and nothing more: if the cut declares a series' cohort, the gallery shows it exactly as the file says; while it does not, the interface stays exactly as it is, without a single badge. An empty value, another type or an ambiguous structure renders nothing either: an invented label would be worse than none. The badge reads the same data the card already holds, downloading nothing extra, and keeps deep links, ordering and the dense mode.",
    ),
    status: "done",
  },
  {
    date: "2026-09-08",
    title: c("F5 pone reglas donde el paper citaba de memoria", "F5 puts rules where the paper quoted from memory"),
    detail: c(
      "El manuscrito cita decenas de cifras y el guardián solo miraba cuatro de las que tienen dueño en los datos: el error prospectivo del sistema, que aparece cinco veces, no lo vigilaba nadie, ni la cobertura empírica, ni el punto de partida de la comparación. Ahora tres reglas los atan a su fuente, y cada ancla se probó para que capture su cifra y ninguna otra: la versión ingenua de la primera se tragaba también el error de otro modelo. Además, el descargo que reconoce las cifras como provisionales deja de ser prosa suelta: el protocolo bajo el que se midieron se declara, y el guardián exige que el texto lo acompañe —obligatorio mientras precedan a la corrección causal, prohibido en cuanto se re-deriven—, con los dos sentidos probados sin ejecutar la campaña. Lo que falta depende de esa campaña, así que la historia queda en observación.",
      "The manuscript cites dozens of figures and the guard watched only four of those with an owner in the data: the system's prospective error, which appears five times, was watched by nobody, nor the empirical coverage, nor the starting point of the comparison. Three rules now tie them to their source, and each anchor was tested to capture its own figure and no other: the naive version of the first also swallowed another model's error. The disclaimer acknowledging the figures as provisional also stops being loose prose: the protocol they were measured under is declared, and the guard requires the text to follow —mandatory while they predate the causal correction, forbidden once they are re-derived— with both directions tested without running the campaign. What remains depends on that campaign, so the story stays under observation.",
    ),
    status: "observing",
  },
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
