import Link from "next/link";
import { BULLETIN_OPERATION } from "@/lib/bulletin-operation";
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
  PLAN_CLOSEOUT,
  PLAN_DELIVERABLES,
  PLAN_EPICS,
  PLAN_META,
  copy,
  epicStats,
  groupUpdatesByDay,
  planFocus,
  planStats,
  storiesStatus,
  type PlanStatus,
} from "@/lib/plan-data";
import { localePath, type Lang } from "@/lib/site-map";
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

// «A6, D5 y D8» en vez de «A6 y D5 y D8»: la lista corrida necesita el conector sólo al final.
const list = (items: { id: string }[], conjunction: string) => {
  const ids = items.map((item) => item.id);
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} ${conjunction} ${ids[ids.length - 1]}`;
};

// El resultado de una historia ya empieza en mayúscula porque se lee suelto en la tarjeta;
// dentro de una frase corrida hay que bajarla, sin tocar siglas como «DVC» o «MASE».
const lower = (text: string) =>
  /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;

// El estado de cada tramo de la ruta sale de sus épicas, no de una etiqueta escrita a mano:
// así el diagrama no puede volver a decir «planificado» sobre una fase ya entregada.
const roadmapStatus = (ids: string[]): PlanStatus => {
  const stories = PLAN_EPICS.filter((epic) => ids.includes(epic.id)).flatMap((epic) => epic.stories);
  return storiesStatus(stories);
};

export function PlanPage({ lang }: { lang: Lang }) {
  const stats = planStats();
  const focus = planFocus();
  const updateDays = groupUpdatesByDay();
  const es = lang === "es";
  const locale = es ? "es-MX" : "en-US";
  const platformClosed = stats.completed === stats.total;

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
                ? "El porcentaje corresponde a las historias de la plataforma MLOps. Su cierre requiere evidencia publicada; no acredita por sí solo aval del asesor, entrega al curso ni presentación."
                : "Progress covers the MLOps platform stories. Closeout requires published evidence; it does not itself establish advisor approval, course submission or presentation."
            }
          />

          <Link href={`${localePath("/ingenieria", lang)}/#sistema`} className={styles.architectureLink}>
            {es ? "Explorar el sistema: flujos, componentes y base de datos" : "Explore the system: flows, components and database"}
            <ArrowRight aria-hidden size={16} />
          </Link>

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
                <p className={styles.metricLabel}>{platformClosed ? es ? "Plataforma entregada" : "Platform delivered" : es ? "Plan activo" : "Active plan"}</p>
                <p className={styles.metricMain}>
                  {stats.advanced} <span>/ {stats.total} US</span>
                </p>
                <p className={styles.metricNote}>
                  {platformClosed
                    ? es ? `${stats.completed} historias cerradas · operación asistida` : `${stats.completed} stories closed · assisted operation`
                    : es
                    ? `${stats.completed} terminadas · ${stats.observing} en observación`
                    : `${stats.completed} done · ${stats.observing} under observation`}
                </p>
              </div>
            </article>

            <div className={styles.metrics}>
              <article>
                <span>{es ? "Fase MLOps" : "MLOps phase"}</span>
                <strong>
                  {platformClosed ? es ? "Operación y mantenimiento" : "Operation and maintenance" : `${focus.epic.id} · ${copy(focus.epic.title, lang)}`}
                </strong>
                <small>
                  {focus.observing.length > 0
                    ? `${focus.observing.map((item) => item.id).join(", ")} ${
                        es ? "observación" : "observation"
                      }`
                    : es
                      ? "Contrato operativo verificado"
                      : "Verified operation contract"}
                </small>
              </article>
              <article>
                <span>{platformClosed ? es ? "Próxima operación" : "Next operation" : es ? "Siguiente historia" : "Next story"}</span>
                <strong>{focus.next ? focus.next.id : platformClosed ? es ? "Próximo boletín" : "Next bulletin" : focus.observing.length ? es ? "Observación" : "Observation" : es ? "Plan cerrado" : "Plan complete"}</strong>
                <small>
                  {focus.next
                    ? copy(focus.next.title, lang)
                    : platformClosed
                      ? es ? "PDF oficial → Make → verificación" : "Official PDF → Make → verification"
                      : es
                      ? "ninguna historia por empezar"
                      : "no stories left to start"}
                </small>
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
                  }).format(new Date(`${focus.updatedAt}T00:00:00Z`))}
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
                ? "G7, el mantenimiento y el corte de noviembre están publicados y verificados. La plataforma pasa a operación asistida desde PDF y evidencia por corrida. La prioridad académica sigue siendo el documento del 6 de noviembre con aval del asesor; compilar o preparar archivos no acredita su entrega. R9 conserva su alcance propio y sigue activo."
                : "G7, maintenance and the November release are published and verified. The platform moves to assisted PDF operation with per-run evidence. Academic priority remains the 6 November document with advisor approval; compiling or preparing files does not establish submission. R9 retains its own scope and remains active."
            }
          />

          <div className={styles.roadmap} aria-label={es ? "Ruta del plan" : "Plan route"}>
            {[
              { id: "0+A+B", label: es ? "Fundación" : "Foundation", epics: ["0", "A", "B"] },
              { id: "D", label: es ? "Plataforma MLOps" : "MLOps platform", epics: ["D"] },
              { id: "C", label: es ? "Clean code" : "Clean code", epics: ["C"] },
              { id: "F", label: es ? "Sincronía total" : "Full synchronization", epics: ["F"] },
              { id: "E", label: es ? "Cohortes y modelos" : "Cohorts and models", epics: ["E"] },
              { id: "G", label: es ? "Cierre académico" : "Academic closeout", epics: ["G"] },
            ].map((step, index, all) => (
              <div className={styles.roadmapStep} key={step.id}>
                <div className={styles.roadmapNode} data-status={roadmapStatus(step.epics)}>
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
              <strong>{es ? "Dentro del tablero MLOps:" : "Within the MLOps board:"}</strong>{" "}
              {focus.next
                ? es
                  ? `Sigue ${focus.next.id} en la épica ${focus.epic.id}: ${lower(copy(focus.next.outcome, lang))}`
                  : `${focus.next.id} is next in epic ${focus.epic.id}: ${lower(copy(focus.next.outcome, lang))}`
                : es
                  ? "No queda ninguna historia por empezar."
                  : "No stories are left to start."}
              {focus.observing.length > 0 &&
                (es
                  ? ` ${list(focus.observing, "y")} ${focus.observing.length > 1 ? "siguen" : "sigue"} en observación.`
                  : ` ${list(focus.observing, "and")} ${focus.observing.length > 1 ? "remain" : "remains"} under observation.`)}
              {focus.deferred.length > 0 &&
                (es
                  ? ` ${list(focus.deferred, "y")} ${focus.deferred.length > 1 ? "quedan diferidas" : "queda diferida"}.`
                  : ` ${list(focus.deferred, "and")} ${focus.deferred.length > 1 ? "stay" : "stays"} deferred.`)}
            </p>
          </div>
        </div>
      </section>

      <section id="cierre" className="section">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Prioridades de cierre" : "Closeout priorities"}
            title={es ? "Entrega académica y próximo boletín" : "Academic delivery and the next bulletin"}
            lead={es
              ? "Las mismas historias y pesos se conservan. El autor adoptó la ingesta asistida desde PDF y la revisión por corrida en lugar de esperar un adaptador web y dos meses automáticos. Los compromisos académicos se acreditan por separado."
              : "The same stories and weights are retained. The owner adopted assisted PDF intake and per-run review in place of a web adapter and two automatic months. Academic commitments require separate evidence."}
          />
          <ol className={styles.timeline}>
            {PLAN_CLOSEOUT.map((item) => (
              <li key={item.id}>
                <h3>{copy(item.title, lang)}</h3>
                <p>{copy(item.detail, lang)}</p>
              </li>
            ))}
          </ol>
          <Link className={styles.architectureLink} href={`${localePath("/ingenieria", lang)}/#operacion-asistida`}>
            {es ? "Cómo actualizar: PDF → Make → corte verificado" : "How to update: PDF → Make → verified release"}
            <ArrowRight aria-hidden size={16} />
          </Link>
          <p>{BULLETIN_OPERATION.acceptance[lang]}</p>
        </div>
      </section>

      <section id="entregables" className="section section--alt">
        <div className="section-inner">
          <SectionHeading
            eyebrow={es ? "Calendario académico" : "Academic schedule"}
            title={es ? "A11–B3 preparados; C1 después de la presentación" : "A11–B3 prepared; C1 after the presentation"}
            lead={es
              ? "Copias de revisión derivadas del documento principal. Preparado no significa entregado, aprobado ni presentado. El PDF para el asesor se compila y verifica en local desde el repositorio documental. Estas actividades no añaden puntos al porcentaje MLOps."
              : "Review copies derived from the main document. Prepared does not mean submitted, approved or presented. The advisor PDF is compiled and verified locally from the documentary repository. These activities add no points to MLOps progress."}
          />
          <ol className={styles.timeline}>
            {PLAN_DELIVERABLES.map((item) => (
              <li key={item.id}>
                <h3>{item.id} · {copy(item.title, lang)}</h3>
                <p>{copy(item.scope, lang)}</p>
                <p>{copy(item.due, lang)} · {item.status === "prepared"
                  ? es ? "Preparado para revisión; sin acuse de entrega" : "Prepared for review; no submission receipt"
                  : es ? "Pendiente de un evento real" : "Awaiting a real event"}</p>
                {item.pdf && <a className={styles.architectureLink} href={item.pdf}>
                  {es ? `Revisar PDF ${item.id}` : `Review ${item.id} PDF`}
                  <ArrowRight aria-hidden size={16} />
                </a>}
              </li>
            ))}
          </ol>
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
                    <StatusBadge status={storiesStatus(epic.stories)} lang={lang} />
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
                <details key={epic.id} open={epic.id === focus.epic.id}>
                  <summary>
                    <span className={styles.detailCode}>{epic.id}</span>
                    <span className={styles.detailTitle}>
                      <strong>{copy(epic.title, lang)}</strong>
                      <small>{progress.completed}/{progress.total} · {progress.percent}%</small>
                    </span>
                    <StatusBadge status={storiesStatus(epic.stories)} lang={lang} />
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
                ? "Cada entrada conserva el estado que tenía en su fecha. Los estados históricos no son pendientes vigentes; el cierre actual aparece arriba. La evidencia es un commit, CI, release o recibo."
                : "Each entry retains its state at that date. Historical states are not current pending work; current closeout appears above. Evidence is a commit, CI, release or receipt."
            }
          />

          <div className={styles.dailyLog}>
            {updateDays.map((day) => (
              <section
                className={styles.daySection}
                data-plan-day={day.date}
                key={day.date}
                aria-labelledby={`plan-day-${day.date}`}
              >
                <header className={styles.dayHeader}>
                  <h3 id={`plan-day-${day.date}`}>
                    <time dateTime={day.date}>
                      {new Intl.DateTimeFormat(locale, {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${day.date}T00:00:00Z`))}
                    </time>
                  </h3>
                  <span>
                    {day.updates.length}{" "}
                    {es
                      ? day.updates.length === 1
                        ? "avance"
                        : "avances"
                      : day.updates.length === 1
                        ? "update"
                        : "updates"}
                  </span>
                </header>

                <ol className={styles.timeline}>
                  {day.updates.map((update) => (
                    <li key={`${update.date}-${update.title.es}`}>
                      <div>
                        <div className={styles.timelineTitle}>
                          <h4>{copy(update.title, lang)}</h4>
                          <StatusBadge status={update.status} lang={lang} />
                        </div>
                        <p>{copy(update.detail, lang)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

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
