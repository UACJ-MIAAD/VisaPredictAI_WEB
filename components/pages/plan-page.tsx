import {
  ArrowRight,
  Check,
  CircleDot,
  Clock3,
  Pause,
  Route,
} from "lucide-react";
import { RouteHeader } from "@/components/route-header";
import {
  PAUSED_TRACK,
  PLAN_EPICS,
  PLAN_META,
  PLAN_UPDATES,
  copy,
  epicStats,
  planStats,
  type PlanStatus,
} from "@/lib/plan-data";
import type { Lang } from "@/lib/site-map";
import styles from "./plan-page.module.css";

const STATUS_LABEL: Record<PlanStatus, { es: string; en: string }> = {
  done: { es: "Terminado", en: "Done" },
  observing: { es: "En observación", en: "Under observation" },
  active: { es: "En curso", en: "In progress" },
  planned: { es: "Planificado", en: "Planned" },
  deferred: { es: "Diferido", en: "Deferred" },
  paused: { es: "Pausado", en: "Paused" },
};

const STATUS_ICON = {
  done: Check,
  observing: Clock3,
  active: CircleDot,
  planned: ArrowRight,
  deferred: Pause,
  paused: Pause,
} satisfies Record<PlanStatus, typeof Check>;

function StatusBadge({ status, lang }: { status: PlanStatus; lang: Lang }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={styles.status} data-status={status}>
      <Icon aria-hidden size={13} strokeWidth={2.25} />
      {STATUS_LABEL[status][lang]}
    </span>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span className="section-tag">{eyebrow}</span>
      <h2 className="section-title">{title}</h2>
      <p className="section-sub">{lead}</p>
    </div>
  );
}

export function PlanPage({ lang }: { lang: Lang }) {
  const stats = planStats();
  const es = lang === "es";
  const locale = es ? "es-MX" : "en-US";

  return (
    <>
      <RouteHeader path="/plan" />

      <section id="tablero" className="section">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Estado verificable" : "Verifiable status"}
            title={es ? "El plan, sin humo" : "The plan, without hand-waving"}
            lead={
              es
                ? "Un tablero vivo del plan MLOps v2. El porcentaje se calcula desde las historias de usuario; los trabajos pausados no se esconden ni inflan el avance."
                : "A living dashboard for the MLOps v2 plan. Progress is calculated from user stories; paused work is neither hidden nor used to inflate completion."
            }
          />

          <div className={styles.dashboard}>
            <article className={styles.scoreCard}>
              <div
                className={styles.scoreRing}
                style={{ "--plan-progress": `${stats.percent * 3.6}deg` } as React.CSSProperties}
                role="img"
                aria-label={`${stats.percent}% ${es ? "del plan completado" : "of the plan completed"}`}
              >
                <span>{stats.percent}%</span>
                <small>{es ? "avance" : "progress"}</small>
              </div>
              <div>
                <p className={styles.metricLabel}>{es ? "Plan activo" : "Active plan"}</p>
                <p className={styles.metricMain}>
                  {stats.advanced} <span>/ {stats.total} US</span>
                </p>
                <p className={styles.metricNote}>
                  {es
                    ? `${stats.completed} terminadas · ${stats.observing} en observación`
                    : `${stats.completed} done · ${stats.observing} under observation`}
                </p>
              </div>
            </article>

            <div className={styles.metrics}>
              <article>
                <span>{es ? "Fase actual" : "Current phase"}</span>
                <strong>D · MLOps</strong>
                <small>{es ? "D7 observación 0/2" : "D7 observation 0/2"}</small>
              </article>
              <article>
                <span>{es ? "Siguiente" : "Next"}</span>
                <strong>D9 → D8</strong>
                <small>{es ? "arquitectura y documentación" : "architecture and documentation"}</small>
              </article>
              <article>
                <span>{es ? "Producción" : "Production"}</span>
                <strong>{PLAN_META.releaseStatus}</strong>
                <small>{PLAN_META.releaseId}</small>
              </article>
              <article>
                <span>{es ? "Actualizado" : "Updated"}</span>
                <strong>
                  {new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${PLAN_META.updatedAt}T00:00:00Z`))}
                </strong>
                <small>data main · {PLAN_META.dataMain.slice(0, 7)}</small>
              </article>
            </div>
          </div>

          <aside className={styles.paused}>
            <StatusBadge status={PAUSED_TRACK.status} lang={lang} />
            <div>
              <strong>{PAUSED_TRACK.id} · {copy(PAUSED_TRACK.title, lang)}</strong>
              <p>{copy(PAUSED_TRACK.detail, lang)}</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="ruta" className="section section--alt">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Dirección" : "Direction"}
            title={es ? "De plataforma a evidencia" : "From platform to evidence"}
            lead={
              es
                ? "Primero cerramos la plataforma; después reducimos deuda con factura, sincronizamos las seis superficies y sólo entonces entrenamos cohortes."
                : "We close the platform first, then reduce debt with measured payoff, synchronize all six surfaces, and only then train cohorts."
            }
          />

          <div className={styles.roadmap} aria-label={es ? "Ruta del plan" : "Plan route"}>
            {[
              { id: "0+A+B", label: es ? "Fundación" : "Foundation", status: "done" as const },
              { id: "D", label: es ? "Plataforma MLOps" : "MLOps platform", status: "active" as const },
              { id: "C", label: es ? "Clean code" : "Clean code", status: "planned" as const },
              { id: "F", label: es ? "Sincronía total" : "Full synchronization", status: "planned" as const },
              { id: "E", label: es ? "Cohortes y modelos" : "Cohorts and models", status: "planned" as const },
              { id: "G", label: es ? "Cierre académico" : "Academic closeout", status: "planned" as const },
            ].map((step, index, all) => (
              <div className={styles.roadmapStep} key={step.id}>
                <div className={styles.roadmapNode} data-status={step.status}>
                  <span>{step.id}</span>
                  <strong>{step.label}</strong>
                </div>
                {index < all.length - 1 && <ArrowRight aria-hidden className={styles.roadmapArrow} />}
              </div>
            ))}
          </div>

          <div className={styles.nowNext}>
            <Route aria-hidden />
            <p>
              <strong>{es ? "Ahora:" : "Now:"}</strong>{" "}
              {es
                ? "La taxonomía y la extracción por país ya viven en un solo sitio; sigue la auditoría reejecutable. D7 acumula sus dos rebuilds reales y D5 espera la campaña causal F2."
                : "The taxonomy and per-country extraction now live in one place; the re-runnable audit comes next. D7 accumulates its two real rebuilds and D5 waits for the causal F2 campaign."}
            </p>
          </div>
        </div>
      </section>

      <section id="epicas" className="section">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Portafolio" : "Portfolio"}
            title={es ? "Avance por épica" : "Progress by epic"}
            lead={
              es
                ? "Cada barra usa la misma ponderación: terminado 100 %, observación 75 %, en curso 50 % y el resto 0 %."
                : "Every bar uses the same weighting: done 100%, observing 75%, active 50%, and all other states 0%."
            }
          />

          <div className={styles.epicGrid}>
            {PLAN_EPICS.map((epic) => {
              const progress = epicStats(epic);
              return (
                <article className={styles.epicCard} key={epic.id}>
                  <div className={styles.epicTop}>
                    <span className={styles.epicCode}>{epic.id}</span>
                    <StatusBadge status={epic.status} lang={lang} />
                  </div>
                  <h3>{copy(epic.title, lang)}</h3>
                  <p>{copy(epic.summary, lang)}</p>
                  <div className={styles.epicProgressLine}>
                    <span>{progress.percent}%</span>
                    <small>{progress.completed}/{progress.total} {es ? "terminadas" : "done"}</small>
                  </div>
                  <Progress
                    value={progress.percent}
                    label={`${copy(epic.title, lang)}: ${progress.percent}%`}
                  />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="detalle" className="section section--alt">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Backlog trazable" : "Traceable backlog"}
            title={es ? "Plan por épica y US" : "Plan by epic and story"}
            lead={
              es
                ? "Abre una épica para ver el resultado esperado y la evidencia disponible de cada historia."
                : "Open an epic to see the expected outcome and available evidence for every story."
            }
          />

          <div className={styles.epicDetails}>
            {PLAN_EPICS.map((epic) => {
              const progress = epicStats(epic);
              return (
                <details key={epic.id} open={epic.id === PLAN_META.currentEpic}>
                  <summary>
                    <span className={styles.detailCode}>{epic.id}</span>
                    <span className={styles.detailTitle}>
                      <strong>{copy(epic.title, lang)}</strong>
                      <small>{progress.completed}/{progress.total} · {progress.percent}%</small>
                    </span>
                    <StatusBadge status={epic.status} lang={lang} />
                  </summary>
                  <ol className={styles.storyList}>
                    {epic.stories.map((item) => (
                      <li key={item.id}>
                        <span className={styles.storyId}>{item.id}</span>
                        <div>
                          <strong>{copy(item.title, lang)}</strong>
                          <p>{copy(item.outcome, lang)}</p>
                          {item.evidence && <code>{item.evidence}</code>}
                        </div>
                        <StatusBadge status={item.status} lang={lang} />
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section id="bitacora" className="section">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Historial" : "History"}
            title={es ? "Últimos avances" : "Latest progress"}
            lead={
              es
                ? "Esta bitácora cambia únicamente cuando existe evidencia verificable: commit, CI, release o recibo."
                : "This log changes only when verifiable evidence exists: a commit, CI, release or receipt."
            }
          />

          <ol className={styles.timeline}>
            {PLAN_UPDATES.map((update) => (
              <li key={`${update.date}-${update.title.es}`}>
                <time dateTime={update.date}>
                  {new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${update.date}T00:00:00Z`))}
                </time>
                <div>
                  <div className={styles.timelineTitle}>
                    <h3>{copy(update.title, lang)}</h3>
                    <StatusBadge status={update.status} lang={lang} />
                  </div>
                  <p>{copy(update.detail, lang)}</p>
                </div>
              </li>
            ))}
          </ol>

          <aside className={styles.updateContract}>
            <strong>{es ? "Contrato de actualización" : "Update contract"}</strong>
            <p>
              {es
                ? "Cada avance modifica la fuente tipada del plan, recalcula el porcentaje, pasa tests y se publica por una PR auditable. Un plan no equivale a trabajo terminado."
                : "Every advance updates the typed plan source, recalculates progress, passes tests and ships through an auditable PR. Planned work is not completed work."}
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
