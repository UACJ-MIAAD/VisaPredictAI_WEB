import { AlertTriangle, ArrowRight, Check, CircleDot, Lock, Users } from "lucide-react";
import { RouteHeader } from "@/components/route-header";
import { DaysLeft } from "@/components/days-left";
import {
  BACKUPS,
  EXPERTS,
  FPT_BRIER,
  JOURNALS,
  PHASES,
  PUB_META,
  RISKS,
  RULED_OUT,
  t,
  type Lang,
  type TaskStatus,
} from "@/lib/publication-data";

const STATUS: Record<TaskStatus, { es: string; en: string; icon: typeof Check; cls: string }> = {
  done: { es: "Hecho", en: "Done", icon: Check, cls: "text-emerald-700 dark:text-emerald-400" },
  active: { es: "En curso", en: "In progress", icon: CircleDot, cls: "text-blue-700 dark:text-blue-400" },
  planned: { es: "Planificado", en: "Planned", icon: ArrowRight, cls: "text-muted-foreground" },
  blocked: { es: "Requiere a Javier", en: "Needs Javier", icon: Lock, cls: "text-amber-700 dark:text-amber-400" },
};

function Heading({ tag, title, lead }: { tag: string; title: string; lead: string }) {
  return (
    <div className="mb-8">
      <span className="section-tag">{tag}</span>
      <h2 className="section-title">{title}</h2>
      <p className="section-sub">{lead}</p>
    </div>
  );
}

export function PublicationPage({ lang }: { lang: Lang }) {
  const es = lang === "es";
  const tasks = PHASES.flatMap((p) => p.tasks);
  const done = tasks.filter((x) => x.status === "done").length;
  const pct = Math.round((done / tasks.length) * 100);
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(es ? "es-MX" : "en-US", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <RouteHeader path="/publicacion" />

      <section id="tablero" className="section">
        <div className="section-inner">
          <Heading
            tag={es ? "Requisito de titulación" : "Graduation requirement"}
            title={es ? "Del proyecto a una revista indexada" : "From project to indexed journal"}
            lead={
              es
                ? "Plan acordado por una mesa redonda de seis modelos sobre el informe de 27 revistas del autor, verificado en la web el 20 de noviembre de 2026. Nada aquí acredita envío, aceptación ni aval: esos hechos los registra Javier."
                : "Plan agreed by a six-model round table on the author's 27-journal report, web-verified on 20 November 2026. Nothing here certifies submission, acceptance or approval: Javier records those facts."
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-md border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{es ? "Envío objetivo" : "Target submission"}</p>
              <p className="mt-2 font-serif text-3xl font-bold"><DaysLeft iso={PUB_META.targetSubmit} unit={es ? "días" : "days"} /></p>
              <p className="mt-1 text-sm text-muted-foreground">{fmt(PUB_META.targetSubmit)}</p>
            </article>
            <article className="rounded-md border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{es ? "Tope de envío" : "Submission cap"}</p>
              <p className="mt-2 font-serif text-3xl font-bold"><DaysLeft iso={PUB_META.submitBy} unit={es ? "días" : "days"} /></p>
              <p className="mt-1 text-sm text-muted-foreground">{fmt(PUB_META.submitBy)}</p>
            </article>
            <article className="rounded-md border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{es ? "Avance del plan" : "Plan progress"}</p>
              <p className="mt-2 font-serif text-3xl font-bold">{pct} %</p>
              <p className="mt-1 text-sm text-muted-foreground">{done} / {tasks.length} {es ? "tareas" : "tasks"}</p>
            </article>
            <article className="rounded-md border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{es ? "Bloqueos humanos" : "Human blockers"}</p>
              <p className="mt-2 font-serif text-3xl font-bold">{tasks.filter((x) => x.status === "blocked").length}</p>
              <p className="mt-1 text-sm text-muted-foreground">{es ? "recomendaciones de los sinodales" : "examiners’ recommendations"}</p>
            </article>
          </div>
          <p className="mt-6 max-w-[75ch] text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{es ? "Manuscrito: " : "Manuscript: "}</strong>
            <em>{PUB_META.manuscriptTitle}</em>
          </p>
        </div>
      </section>

      <section id="revistas" className="section section--alt">
        <div className="section-inner">
          <Heading
            tag={es ? "Tres revistas" : "Three journals"}
            title={es ? "Dónde es más probable que nos acepten" : "Where acceptance is most likely"}
            lead={
              es
                ? `Basta con que la revista acepte el envío y sólo se paga un APC de hasta USD ${PUB_META.apcCapUsd.toLocaleString("en-US")}. Una cascada, nunca envíos simultáneos: AJSE, luego Computación y Sistemas, luego Inteligencia Artificial, las tres sin costo.`
                : `The journal accepting the submission is enough, and only an APC of up to USD ${PUB_META.apcCapUsd.toLocaleString("en-US")} is paid. One cascade, never simultaneous submissions: AJSE, then Computación y Sistemas, then Inteligencia Artificial, all three at no cost.`
            }
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {JOURNALS.map((j) => (
              <article key={j.name} className="flex flex-col rounded-md border border-border bg-background p-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-4xl font-bold text-primary">{j.rank}</span>
                  <div>
                    <h3 className="text-lg font-semibold leading-tight">
                      <a href={j.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                        {j.name}
                      </a>
                    </h3>
                    <p className="text-sm text-muted-foreground">{j.publisher}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="inline font-semibold">{es ? "Índice: " : "Index: "}</dt><dd className="inline">{t(j.index, lang)}</dd></div>
                  <div><dt className="inline font-semibold">{es ? "Costo: " : "Cost: "}</dt><dd className="inline">{t(j.cost, lang)}</dd></div>
                  <div><dt className="inline font-semibold">{es ? "Velocidad: " : "Speed: "}</dt><dd className="inline">{t(j.speed, lang)}</dd></div>
                  <div><dt className="inline font-semibold">{es ? "Cuándo: " : "When: "}</dt><dd className="inline">{t(j.when, lang)}</dd></div>
                </dl>
                <p className="mt-3 text-sm leading-relaxed">{t(j.why, lang)}</p>
                <p className="mt-auto pt-4 text-sm leading-relaxed text-muted-foreground">
                  <AlertTriangle aria-hidden size={14} className="mr-1 inline align-[-2px]" />
                  {t(j.deskRisk, lang)}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">{es ? "Respaldo" : "Backups"}</h3>
              <ul className="space-y-1 text-sm">
                {BACKUPS.map((b) => (
                  <li key={b.name}><strong>{b.name}</strong> · {t(b.note, lang)}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">{es ? "Descartadas" : "Ruled out"}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {RULED_OUT.map((r) => (
                  <li key={r.es}>{t(r, lang)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="mesa" className="section">
        <div className="section-inner">
          <Heading
            tag={es ? "Mesa redonda" : "Round table"}
            title={es ? "Seis modelos, dos rondas, un plan" : "Six models, two rounds, one plan"}
            lead={
              es
                ? "Cada experto respondió por separado y luego votó una propuesta común. Coincidieron en un solo manuscrito de primer paso calibrado y en no vender fechas a 30 años como pronóstico validado."
                : "Each expert answered independently, then voted on a common proposal. They agreed on one calibrated first-passage manuscript and on not selling 30-year dates as validated forecasts."
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4"><Users aria-hidden size={14} className="mr-1 inline" />{es ? "Experto" : "Expert"}</th>
                  <th className="py-2 pr-4">{es ? "Voto" : "Vote"}</th>
                  <th className="py-2">{es ? "Corrección clave" : "Key correction"}</th>
                </tr>
              </thead>
              <tbody>
                {EXPERTS.map((x) => (
                  <tr key={x.name} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-4"><strong>{x.name}</strong><br /><span className="text-muted-foreground">{x.model}</span></td>
                    <td className="py-3 pr-4">{t(x.vote, lang)}</td>
                    <td className="py-3">{t(x.correction, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="turno" className="section section--alt">
        <div className="section-inner">
          <Heading
            tag={es ? "Fecha de turno a 10–30 años" : "10–30 year turn date"}
            title={es ? "¿Cuándo será current mi fecha de prioridad?" : "When will my priority date become current?"}
            lead={
              es
                ? "Tiempo de primer paso: se simulan miles de trayectorias del corte con bloques de su propia historia y se registra el mes en que alcanzan la fecha. Prototipo preliminar sobre 90 series, orígenes 2006–2024; menor Brier es mejor."
                : "First-passage time: thousands of cutoff paths are simulated from blocks of the series' own history and the month they reach the date is recorded. Preliminary prototype on 90 series, origins 2006–2024; lower Brier is better."
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">{es ? "Horizonte" : "Horizon"}</th>
                  <th className="py-2 pr-4">{es ? "Casos" : "Cases"}</th>
                  <th className="py-2 pr-4">{es ? "Primer paso" : "First passage"}</th>
                  <th className="py-2 pr-4">{es ? "Velocidad lineal" : "Linear velocity"}</th>
                  <th className="py-2">{es ? "Climatología" : "Climatology"}</th>
                </tr>
              </thead>
              <tbody>
                {FPT_BRIER.map((r) => {
                  const wins = r.fpt < r.climatology;
                  return (
                    <tr key={r.months} className="border-b border-border/60">
                      <td className="py-2 pr-4">{r.months / 12} {es ? (r.months === 12 ? "año" : "años") : r.months === 12 ? "year" : "years"}</td>
                      <td className="py-2 pr-4">{r.n.toLocaleString("en-US")}</td>
                      <td className={`py-2 pr-4 font-semibold ${wins ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>{r.fpt.toFixed(3)}</td>
                      <td className="py-2 pr-4">{r.velocity.toFixed(3)}</td>
                      <td className="py-2">{r.climatology.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-[75ch] text-sm leading-relaxed">
            {es
              ? "Lectura honesta: el primer paso gana a la velocidad lineal en todos los horizontes y a la climatología hasta 5 años; a 10–15 años pierde contra la climatología por exceso de confianza en los extremos. El artículo convierte ese cruce en su hallazgo central (el horizonte de predictibilidad) y la versión final añade calibración rodante y ponderada por censura. A 20–30 años el resultado se publica como escenario, con la probabilidad de superar 30 años."
              : "Honest reading: first passage beats linear velocity at every horizon and climatology up to 5 years; at 10–15 years it loses to climatology through overconfidence at the extremes. The paper turns that crossover into its central finding (the predictability horizon), and the final version adds rolling, censoring-weighted calibration. At 20–30 years the result is published as a scenario, with the probability of exceeding 30 years."}
          </p>
        </div>
      </section>

      <section id="ruta" className="section">
        <div className="section-inner">
          <Heading
            tag={es ? "Plan brutalista" : "Brutalist plan"}
            title={es ? "Semana a semana hasta la aceptación" : "Week by week to acceptance"}
            lead={
              es
                ? "Cada fase tiene criterio de terminado. Las tareas en ámbar dependen de Javier y bloquean la elección final de revista."
                : "Each phase has a definition of done. Amber tasks depend on Javier and block the final journal choice."
            }
          />
          <ol className="space-y-6">
            {PHASES.map((p) => (
              <li key={p.id} className="rounded-md border border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.id} · {t(p.title, lang)}</h3>
                  <span className="text-sm text-muted-foreground">{p.weeks}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {p.tasks.map((x) => {
                    const s = STATUS[x.status];
                    const Icon = s.icon;
                    return (
                      <li key={x.id} className="flex gap-3 text-sm">
                        <span className={`mt-0.5 shrink-0 ${s.cls}`} title={s[lang]}>
                          <Icon aria-hidden size={15} />
                          <span className="sr-only">{s[lang]}</span>
                        </span>
                        <span><span className="text-muted-foreground">{x.id}</span> {t(x.text, lang)}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="riesgos" className="section section--alt">
        <div className="section-inner">
          <Heading
            tag={es ? "Riesgos" : "Risks"}
            title={es ? "Lo que mata la publicación" : "What kills the publication"}
            lead={es ? "Y cómo se neutraliza cada uno." : "And how each one is neutralised."}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {RISKS.map((r) => (
              <article key={r.title.es} className="rounded-md border border-border bg-background p-5">
                <h3 className="font-semibold">{t(r.title, lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(r.fix, lang)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
