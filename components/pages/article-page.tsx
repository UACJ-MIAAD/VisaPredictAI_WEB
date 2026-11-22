import Link from "next/link";
import { ArrowRight, Check, CircleDashed, MessageSquareText } from "lucide-react";
import data from "@/lib/article/article-facts.json";
import { articleModel } from "@/lib/article/article-copy.mjs";
import { localePath } from "@/lib/site-map";
import { HeroVisual } from "@/components/article/hero-visual";
import { HorizonChart, METHOD_COLOR } from "@/components/article/horizon-chart";
import { ExampleExplorer } from "@/components/article/example-explorer";
import { Forest } from "@/components/article/forest";
import { LandscapeGrid } from "@/components/article/landscape-grid";
import styles from "@/components/article/article.module.css";

// /articulo · versión web del artículo científico. Todo el texto con cifras sale de
// lib/article/article-copy.mjs (el mismo modelo que indexa VisaBot), y las cifras del
// article-facts.json exportado desde facts.tex del manuscrito.

function Heading({ tag, title, lead, id }: { tag: string; title: string; lead?: string; id?: string }) {
  return (
    <div className={styles.heading}>
      <span className="section-tag">{tag}</span>
      <h2 className="section-title" id={id}>{title}</h2>
      {lead && <p className="section-sub">{lead}</p>}
    </div>
  );
}

export function ArticlePage({ lang }: { lang: "es" | "en" }) {
  const es = lang === "es";
  const m = articleModel(data, lang);
  const s = m.sections;
  const [q, rest] = (() => {
    const i = m.title.indexOf("?");
    return i > 0 ? [m.title.slice(0, i + 1), m.title.slice(i + 1).trim()] : [m.title, ""];
  })();
  const ask = (text: string) => `${localePath("/asistente", lang)}?q=${encodeURIComponent(text)}`;

  const steps = [
    { done: true, text: es ? "Análisis sin fuga y cifras generadas por código" : "Leakage-free analysis and code-generated numbers" },
    { done: true, text: es ? "Manuscrito en inglés y versión en español" : "English manuscript and Spanish version" },
    { done: true, text: es ? "Integración continua: autoría, cifras y LaTeX" : "Continuous integration: authorship, numbers and LaTeX" },
    { done: false, text: es ? "Revisión del director" : "Advisor's review" },
    { done: false, text: es ? "Paquete de reproducibilidad con DOI" : "Reproducibility package with DOI" },
    { done: false, text: es ? "Envío a la revista y sello del registro prospectivo" : "Journal submission and prospective-registry seal" },
    { done: false, text: es ? "Evaluación pública del registro desde 2028" : "Public scoring of the registry from 2028" },
  ];

  return (
    <article className={styles.page}>
      {/* ── Hero ── */}
      <section id="articulo" className={`section section--deep ${styles.hero}`}>
        <div className={`section-inner ${styles.heroGrid}`}>
          <div>
            <p className={styles.kicker}>{es ? "Artículo científico · manuscrito" : "Scientific article · manuscript"}</p>
            <h1 className={styles.heroTitle}>{q}</h1>
            {rest && <p className={styles.heroSub}>{rest}</p>}
            <ul className={styles.authors}>
              {m.authors.map((a) => (
                <li key={a.name}><strong>{a.name}</strong><span>{a.role}</span></li>
              ))}
            </ul>
            <p className={styles.affil}>{m.affiliation}</p>
            <div className={styles.heroCtas}>
              <a href="#resumen-articulo" className={styles.ctaPrimary}>{es ? "Leer el resumen" : "Read the abstract"} <ArrowRight size={16} aria-hidden /></a>
              <Link href={ask(m.faq[0].q)} className={styles.ctaGhost}><MessageSquareText size={16} aria-hidden /> {es ? "Pregúntale a VisaBot" : "Ask VisaBot"}</Link>
            </div>
            <p className={styles.statusChip}><CircleDashed size={14} aria-hidden /> {s.estado.title}</p>
          </div>
          <HeroVisual lang={lang} />
        </div>
      </section>

      {/* ── Cifras ── */}
      <section className={`section ${styles.statsSection}`} aria-label={es ? "Cifras del artículo" : "Article figures"}>
        <div className="section-inner">
          <dl className={styles.stats}>
            {m.stats.map((x) => (
              <div key={x.label} className={styles.stat}>
                <dt className={styles.statLabel}>{x.label}</dt>
                <dd className={styles.statValue}>{x.value}</dd>
                <dd className={styles.statSub}>{x.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Resumen ── */}
      <section id="resumen-articulo" className="section">
        <div className={`section-inner ${styles.abstractGrid}`}>
          <Heading tag={es ? "Resumen" : "Abstract"} title={m.shortTitle} />
          <div>
            <p className={styles.abstract}>{m.abstract}</p>
            <ul className={styles.keywords} aria-label={es ? "Palabras clave" : "Keywords"}>
              {m.keywords.map((k) => <li key={k}>{k}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* ── La pregunta + Acto I ── */}
      <section id="pregunta" className="section">
        <div className={`section-inner ${styles.twoCol}`}>
          <div>
            <Heading tag={s.pregunta.tag} title={s.pregunta.title} />
            {s.pregunta.paras.map((p) => <p key={p} className={styles.prose}>{p}</p>)}
          </div>
          <div className={styles.actOne}>
            <span className="section-tag">{s.acto1.tag}</span>
            <h3 className={styles.h3}>{s.acto1.title}</h3>
            {s.acto1.paras.map((p) => <p key={p} className={styles.prose}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* ── Métodos + protocolo ── */}
      <section id="metodos" className="section">
        <div className="section-inner">
          <Heading tag={s.metodos.tag} title={s.metodos.title} lead={s.metodos.lead} />
          <ol className={styles.methods}>
            {m.methods.map((x) => (
              <li key={x.id} className={styles.method} style={{ ["--m" as string]: METHOD_COLOR[x.id] }}>
                <h3>{x.label}</h3>
                <p>{x.desc}</p>
              </li>
            ))}
          </ol>
          <div className={styles.protocol}>
            <div>
              <span className="section-tag">{s.protocolo.tag}</span>
              <h3 className={styles.h3}>{s.protocolo.title}</h3>
            </div>
            <ol className={styles.rules}>
              {s.protocolo.rules.map((r, i) => (
                <li key={r.title}><span className={styles.ruleN}>{i + 1}</span><div><h4>{r.title}</h4><p>{r.text}</p></div></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Resultados ── */}
      <section id="resultados" className="section">
        <div className="section-inner">
          <Heading tag={s.resultados.tag} title={s.resultados.title} />
          <div className={styles.resultsGrid}>
            <div>{s.resultados.paras.map((p) => <p key={p} className={styles.prose}>{p}</p>)}</div>
            <figure className={styles.figure}>
              <HorizonChart m={m} />
              <figcaption className={styles.caption}>{s.resultados.chartNote}</figcaption>
            </figure>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <caption>{es ? "Puntaje de Brier de P(T ≤ K) en orígenes con desenlace observado (menor es mejor)" : "Brier score of P(T ≤ K) on fully observed origins (lower is better)"}</caption>
              <thead>
                <tr>
                  <th scope="col">{es ? "Horizonte" : "Horizon"}</th>
                  <th scope="col">{es ? "Casos" : "Cases"}</th>
                  <th scope="col">{es ? "Referencia" : "Reference"}</th>
                  {m.methods.map((x) => <th key={x.id} scope="col">{x.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {m.horizons.map((h) => (
                  <tr key={h.k}>
                    <th scope="row">{h.label}</th><td>{h.n}</td><td>{h.brier.ref}</td>
                    {m.methods.map((x) => <td key={x.id}>{h.brier[x.id]}</td>)}
                  </tr>
                ))}
                {m.long.map((h) => (
                  <tr key={h.k} className={styles.scenarioRow}>
                    <th scope="row">{h.label}</th><td>{h.n}</td><td>—</td><td>—</td>
                    <td>{h.brier.sim}</td><td>{h.brier.rw}</td><td>{h.brier.vel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Robustez + mapa ── */}
      <section id="robustez" className="section">
        <div className="section-inner">
          <Heading tag={s.sensibilidad.tag} title={s.sensibilidad.title} lead={s.sensibilidad.lead} />
          <div className={styles.forestGrid}>
            <Forest rows={m.designs} lang={lang} title={es ? "BSS de la combinación por diseño" : "Blend BSS by design"} />
            <div>
              <p className={styles.prose}>{s.sensibilidad.subLead}</p>
              <Forest rows={m.subgroups} lang={lang} title={es ? "BSS de la combinación por tipo de cola y tabla" : "Blend BSS by queue type and table"} />
            </div>
          </div>
          <div className={styles.mapBlock}>
            <Heading tag={s.mapa.tag} title={s.mapa.title} lead={s.mapa.lead} />
            <LandscapeGrid m={m} />
          </div>
        </div>
      </section>

      {/* ── Largo plazo ── */}
      <section id="largo" className={`section section--deep ${styles.longBand}`}>
        <div className={`section-inner ${styles.twoCol}`}>
          <Heading tag={s.largo.tag} title={s.largo.title} />
          <div>{s.largo.paras.map((p) => <p key={p} className={styles.proseLight}>{p}</p>)}</div>
        </div>
      </section>

      {/* ── Ejemplos ── */}
      <section id="ejemplos" className="section">
        <div className="section-inner">
          <Heading tag={s.ejemplos.tag} title={s.ejemplos.title} lead={s.ejemplos.lead} />
          <ExampleExplorer m={m} />
        </div>
      </section>

      {/* ── Límites + estado ── */}
      <section id="limites" className="section">
        <div className={`section-inner ${styles.twoCol}`}>
          <div>
            <Heading tag={s.limites.tag} title={s.limites.title} />
            <ul className={styles.limits}>{s.limites.items.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <Heading tag={s.estado.tag} title={s.estado.title} />
            {s.estado.paras.map((p) => <p key={p} className={styles.prose}>{p}</p>)}
            <ol className={styles.timeline}>
              {steps.map((x) => (
                <li key={x.text} data-done={x.done}>
                  {x.done ? <Check size={15} aria-hidden /> : <CircleDashed size={15} aria-hidden />}
                  <span>{x.text}</span>
                  <span className="sr-only">{x.done ? (es ? "hecho" : "done") : (es ? "pendiente" : "pending")}</span>
                </li>
              ))}
            </ol>
            <p className={styles.prose}>
              <Link href={localePath("/publicacion", lang)} className={styles.inlineLink}>
                {es ? "Plan de publicación y revistas objetivo" : "Publication plan and target journals"} <ArrowRight size={14} aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── VisaBot ── */}
      <section id="visabot" className="section">
        <div className="section-inner">
          <Heading tag="VisaBot" title={es ? "Pregúntale al asistente por el artículo" : "Ask the assistant about the article"}
            lead={es ? "VisaBot leyó esta página: responde con las mismas cifras y cita la sección de donde las toma." : "VisaBot has read this page: it answers with the same numbers and cites the section they come from."} />
          <ul className={styles.askList}>
            {m.faq.map((f) => (
              <li key={f.q}><Link href={ask(f.q)} className={styles.ask}><MessageSquareText size={16} aria-hidden /> {f.q}</Link></li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
