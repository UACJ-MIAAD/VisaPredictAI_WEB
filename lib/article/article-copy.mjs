// Artículo científico · contenido bilingüe de /articulo y de VisaBot (fuente ÚNICA).
//
// Cifras: TODAS salen de article-facts.json, que exporta REVISTA2027/tools/export_web_facts.py
// desde manuscript/facts.tex (el mismo archivo que alimenta el PDF) y el título/resumen/palabras
// clave de main.tex y es/main_es.tex. Aquí no se teclea ningún resultado: si una macro cambia de
// nombre o desaparece, `fx()` lanza y el build se cae (regla #0).
//
// Únicos insumos que no son resultados: las fechas de prioridad de los ejemplos trabajados
// (enero de 2020 y junio de 2015), que el manuscrito fija como entrada en su texto.
//
// Plain .mjs: lo importan la página (Next) y scripts/build-rag-index.mjs (Node).

/** @typedef {"es" | "en"} Lang */

/** Texto de una macro de facts.tex ya limpia (p. ej. "0.028", "[−0.029, 0.089]", "26 %"). */
export function fx(data, name) {
  const f = data.facts[name];
  if (!f) throw new Error(`article-facts: falta la macro \\${name} (¿cambió facts.tex?)`);
  return f.text;
}

/** Valor numérico de una macro (o de un intervalo, [lo, hi]). */
export function fv(data, name) {
  const f = data.facts[name];
  if (!f) throw new Error(`article-facts: falta la macro \\${name}`);
  if (f.ci) return f.ci;
  if (typeof f.value !== "number") throw new Error(`article-facts: \\${name} no es numérica (${f.text})`);
  return f.value;
}

const HZ = [
  { k: 1, w: "One" },
  { k: 3, w: "Three" },
  { k: 5, w: "Five" },
];

const pct = (txt) => txt.replace(/\s*%$/, " %");

/** Construye todo el contenido de la página para un idioma. */
export function articleModel(data, lang) {
  const es = lang === "es";
  const L = (a, b) => (es ? a : b);
  const t = (n) => fx(data, n);
  const v = (n) => fv(data, n);
  const front = data[lang];

  const methods = [
    {
      id: "blend",
      label: L("Combinación", "Blend"),
      desc: L(
        "Combina la simulación de la propia serie con la clase de referencia, con pesos ajustados sólo con desenlaces ya conocidos en cada origen.",
        "Combines the series' own simulation with the reference class, with weights fitted only on outcomes already known at each origin.",
      ),
    },
    {
      id: "sim",
      label: L("Simulación de la serie", "Series simulation"),
      desc: L(
        "Remuestrea bloques de incrementos mensuales de los últimos diez años de cada serie y cuenta en cuántas trayectorias el corte rebasa la fecha.",
        "Resamples blocks of monthly increments from the last ten years of each series and counts how many paths cross the date.",
      ),
    },
    {
      id: "rw",
      label: L("Caminata aleatoria gaussiana", "Gaussian random walk"),
      desc: L(
        "Caminata aleatoria con deriva ajustado a los mismos incrementos: el modelo estocástico más simple.",
        "Random walk with drift fitted to the same increments: the simplest stochastic model.",
      ),
    },
    {
      id: "vel",
      label: L("Velocidad lineal", "Linear velocity"),
      desc: L(
        "Divide la brecha restante entre el avance promedio: lo que hacen las calculadoras públicas.",
        "Divides the remaining gap by the average advance: what public calculators do.",
      ),
    },
  ];

  const key = { blend: "SBlend", sim: "SSim", rw: "SRw", vel: "SVel" };
  const horizons = HZ.map(({ k, w }) => ({
    k,
    label: es ? `${k} ${k === 1 ? "año" : "años"}` : `${k} ${k === 1 ? "year" : "years"}`,
    n: t(`fN${w}`),
    series: t(`fSer${w}`),
    upper: t(`fUBlend${w}`),
    methods: Object.fromEntries(
      Object.entries(key).map(([id, m]) => [
        id,
        { value: v(`f${m}${w}`), text: t(`f${m}${w}`), ci: v(`f${m}${w}Ci`), ciText: t(`f${m}${w}Ci`) },
      ]),
    ),
    brier: {
      blend: t(`fBBlend${w}`),
      ref: t(`fBRef${w}`),
      sim: t(`fBSim${w}`),
      rw: t(`fBRw${w}`),
      vel: t(`fBVel${w}`),
    },
  }));

  const long = [
    { k: 10, w: "Ten" },
    { k: 15, w: "Fifteen" },
  ].map(({ k, w }) => ({
    k,
    label: es ? `${k} años` : `${k} years`,
    n: t(`fN${w}`),
    series: t(`fSer${w}`),
    brier: { sim: t(`fBSim${w}`), rw: t(`fBRw${w}`), vel: t(`fBVel${w}`) },
  }));

  const designs = [
    { id: "primary", label: L("Diseño principal", "Primary design"), m: "SBlend" },
    { id: "strat", label: L("Referencia estratificada", "Stratified reference"), m: "SBlendStrat" },
    { id: "hold", label: L("Últimos orígenes retenidos", "Latest origins held out"), m: "SHoldBlend" },
    { id: "full", label: L("Historia completa", "Full history"), m: "SFullBlend" },
    { id: "block", label: L("Bloques de 24 meses", "24-month blocks"), m: "SBlockBlend" },
  ].map((d) => ({
    id: d.id,
    label: d.label,
    points: HZ.map(({ k, w }) => ({ k, value: v(`f${d.m}${w}`), text: t(`f${d.m}${w}`), ci: v(`f${d.m}${w}Ci`), ciText: t(`f${d.m}${w}Ci`) })),
  }));

  const subgroups = [
    { id: "fam", label: L("Familiares", "Family"), m: "SgFam" },
    { id: "emp", label: L("Empleo", "Employment"), m: "SgEmp" },
    { id: "fad", label: "FAD", m: "SgFad" },
    { id: "dff", label: "DFF", m: "SgDff" },
  ].map((g) => ({
    id: g.id,
    label: g.label,
    points: HZ.map(({ k, w }) => ({ k, value: v(`f${g.m}${w}`), text: t(`f${g.m}${w}`), ci: v(`f${g.m}${w}Ci`), ciText: t(`f${g.m}${w}Ci`), n: t(`f${g.m}${w}N`) })),
  }));

  const gaps = [
    { g: 1, w: "One" },
    { g: 3, w: "Three" },
    { g: 5, w: "Five" },
    { g: 8, w: "Eight" },
    { g: 12, w: "Twelve" },
  ];
  const landscape = {
    gaps: gaps.map((x) => x.g),
    horizons: HZ.map((x) => x.k),
    cells: gaps.map(({ g, w: gw }) =>
      HZ.map(({ k, w: hw }) => {
        const f = data.facts[`fGp${gw}${hw}`];
        if (!f) throw new Error(`article-facts: falta \\fGp${gw}${hw}`);
        return { g, k, value: typeof f.value === "number" ? f.value : null, text: f.text, base: t(`fGp${gw}${hw}Base`) };
      }),
    ),
    nByHorizon: HZ.map(({ w }) => t(`fGpOne${w}N`)),
  };

  const ex = (id, p, name, nameEn, pdEs, pdEn, evaluated) => ({
    id,
    name: es ? name : nameEn,
    pd: es ? pdEs : pdEn,
    cut: t(es ? `fEx${p}CutEs` : `fEx${p}Cut`),
    gap: t(`fEx${p}Gap`),
    evaluated,
    blend: HZ.map(({ k, w }) => ({ k, text: pct(t(`fEx${p}Blend${w}`)), value: v(`fEx${p}Blend${w}`) })),
    scenario: [5, 10, 20, 30].map((y) => {
      const w = { 5: "Five", 10: "Ten", 20: "Twenty", 30: "Thirty" }[y];
      return { years: y, text: pct(t(`fEx${p}SimLe${w}`)), value: v(`fEx${p}SimLe${w}`) };
    }),
    median: t(es ? `fEx${p}SimMedianEs` : `fEx${p}SimMedian`),
  });
  const examples = [
    ex("in-eb2", "In", "India EB-2", "India EB-2", "enero de 2020", "January 2020", true),
    ex("mx-f2b", "MxB", "México F2B", "Mexico F2B", "enero de 2020", "January 2020", true),
    ex("ph-f4", "Ph", "Filipinas F4", "Philippines F4", "enero de 2020", "January 2020", true),
    ex("mx-f3", "MxThree", "México F3", "Mexico F3", "junio de 2015", "June 2015", false),
  ];

  const stats = [
    { value: t("fBulletins"), label: L("boletines mensuales", "monthly bulletins"), sub: L("diciembre de 2001 a noviembre de 2026", "December 2001 to November 2026") },
    { value: t("fRows"), label: L("observaciones del panel", "panel observations"), sub: L(`${t("fSeriesAll")} series país × categoría × tabla`, `${t("fSeriesAll")} country × category × table series`) },
    { value: t("fNModels"), label: L("modelos comparados a un mes", "models compared one month ahead"), sub: L("ninguno supera de forma significativa a la caminata aleatoria", "none significantly beats the random walk") },
    { value: t("fSeriesUsed"), label: L("series con pronósticos de espera", "series with waiting-time forecasts"), sub: L(`${t("fCasesTotal")} casos · ${t("fClusters")} colas país–categoría`, `${t("fCasesTotal")} cases · ${t("fClusters")} country–category queues`) },
  ];

  const bounds = HZ.map(({ w }) => t(`fUBlend${w}`));

  const sections = {
    pregunta: {
      tag: L("La pregunta", "The question"),
      title: L("No es el boletín del mes que entra: es el mes en que llega tu turno", "Not next month's bulletin: the month your turn comes"),
      paras: [
        L(
          "El Visa Bulletin publica cada mes una fecha de corte por país, categoría y tabla. Quien tiene una fecha de prioridad anterior al corte puede avanzar; los demás esperan, a veces décadas.",
          "Every month the Visa Bulletin publishes a cutoff date per country, category and table. Applicants whose priority date is earlier than the cutoff may proceed; the rest wait, sometimes for decades.",
        ),
        L(
          `En noviembre de 2026 el corte FAD de México F3 está en el ${t("fExMxThreeCutEs")}. Para alguien con fecha de prioridad de junio de 2015 la brecha es de ${t("fExMxThreeGap")} años: la unidad de medida es la década.`,
          `In November 2026 the FAD cutoff for Mexico F3 stands at ${t("fExMxThreeCut")}. For an applicant with a June 2015 priority date the gap is ${t("fExMxThreeGap")} years: the unit of measure is the decade.`,
        ),
        L(
          "La pregunta del solicitante es de tiempo de primer paso: ¿qué probabilidad hay de que el corte rebase mi fecha dentro de K años? El artículo la responde con probabilidades y la evalúa con un protocolo sin fuga de información.",
          "The applicant's question is a first-passage question: what is the probability that the cutoff passes my date within K years? The article answers it with probabilities and scores it with a leakage-free protocol.",
        ),
      ],
    },
    acto1: {
      tag: L("Acto I · un mes", "Act I · one month"),
      title: L("A un mes, nadie le gana a la caminata aleatoria", "One month ahead, nothing beats the random walk"),
      paras: [
        L(
          `Se compararon ${t("fNModels")} modelos, de los ingenuos a las redes profundas, con validación sin fuga. En las ${t("fSigSeriesFad")} series FAD comunes a ${t("fSigModelsFad")} modelos, el conjunto de confianza de modelos al 90 % contiene sólo a la caminata aleatoria a un mes, con rango promedio de Friedman de ${t("fRankNaiveFad")}.`,
          `${t("fNModels")} models, from naïve to deep networks, were compared under leakage-free validation. On the ${t("fSigSeriesFad")} FAD series common to ${t("fSigModelsFad")} models, the 90 % model confidence set contains only the one-month random walk, with an average Friedman rank of ${t("fRankNaiveFad")}.`,
        ),
        L(
          `La razón es estructural: el ${t("fPctFrozen")} % de los meses el corte no se mueve y los saltos responden a decisiones administrativas de cupo. Si el mes siguiente no es pronosticable mejor que «igual que hoy», la pregunta útil es otra.`,
          `The reason is structural: in ${t("fPctFrozen")} % of months the cutoff does not move, and jumps follow administrative quota decisions. If next month cannot be forecast better than "same as today", the useful question is a different one.`,
        ),
      ],
    },
    metodos: {
      tag: L("Cuatro respuestas", "Four answers"),
      title: L("Cuatro maneras de estimar la espera, y una vara de medir", "Four ways to estimate the wait, and one yardstick"),
      lead: L(
        "La vara es la clase de referencia: con qué frecuencia, en el pasado, se cubrió una brecha del mismo tamaño dentro del mismo horizonte. Todo se compara contra ella con el índice de habilidad de Brier (BSS): positivo es mejor que la referencia, negativo es peor.",
        "The yardstick is the reference class: how often, in the past, a gap of the same size was covered within the same horizon. Everything is compared against it with the Brier skill score (BSS): positive beats the reference, negative is worse.",
      ),
    },
    protocolo: {
      tag: L("Protocolo", "Protocol"),
      title: L("Sin mirar el futuro, ni siquiera de reojo", "No peeking at the future, not even sideways"),
      rules: [
        {
          title: L("Sólo desenlaces observados", "Only observed outcomes"),
          text: L(
            `Cada horizonte se evalúa sólo en orígenes cuyo desenlace ya se conoce en noviembre de 2026. Los orígenes son anuales desde ${t("fFirstOrigin")}.`,
            `Each horizon is scored only at origins whose outcome is already known in November 2026. Origins are annual from ${t("fFirstOrigin")}.`,
          ),
        },
        {
          title: L("Todo con lo que se sabía en el origen", "Everything with what was known at the origin"),
          text: L(
            "Elegibilidad de series, clase de referencia, recalibración y pesos de la combinación se ajustan sólo con casos cuyo desenlace ya era conocido en el origen del pronóstico.",
            "Series eligibility, reference class, recalibration and blend weights are fitted only on cases whose outcome was already known at the forecast origin.",
          ),
        },
        {
          title: L("Incertidumbre por cola y por año", "Uncertainty by queue and by year"),
          text: L(
            `Los intervalos al 95 % vienen de un bootstrap bidimensional que remuestrea las ${t("fClusters")} colas país–categoría y los años de origen, porque las colas comparten decisiones y los años comparten choques.`,
            `The 95 % intervals come from a two-way bootstrap that resamples the ${t("fClusters")} country–category queues and the origin years, because queues share decisions and years share shocks.`,
          ),
        },
      ],
    },
    resultados: {
      tag: L("Acto II · resultados", "Act II · results"),
      title: L("La referencia es el pronóstico a vencer", "The reference class is the forecast to beat"),
      paras: [
        L(
          `La velocidad lineal de las calculadoras públicas es claramente peor que la referencia en todo horizonte: BSS de ${t("fSVelOne")} a un año y ${t("fSVelFive")} a cinco, con intervalos que no tocan el cero.`,
          `The linear velocity of public calculators is detectably worse than the reference at every horizon: BSS of ${t("fSVelOne")} at one year and ${t("fSVelFive")} at five, with intervals that stay away from zero.`,
        ),
        L(
          "Ni la simulación de la serie ni la caminata aleatoria gaussiana son mejores de forma detectable que la referencia.",
          "Neither the series simulation nor the Gaussian random walk is detectably better than the reference.",
        ),
        L(
          `La combinación obtiene ${t("fSBlendOne")}, ${t("fSBlendThree")} y ${t("fSBlendFive")} a uno, tres y cinco años. La ganancia es positiva en todos los análisis de sensibilidad, pero ningún intervalo al 95 % excluye el cero; sus límites superiores (${bounds.join(", ")}) acotan cuánto pueden ayudar estos datos.`,
          `The blend scores ${t("fSBlendOne")}, ${t("fSBlendThree")}, and ${t("fSBlendFive")} at one, three, and five years. The gain is positive in every sensitivity analysis, but no 95 % interval excludes zero; its upper limits (${bounds.join(", ")}) bound how much these data can help.`,
        ),
      ],
      chartNote: L(
        "Índice de habilidad de Brier frente a la clase de referencia (la línea cero). Barras: intervalo al 95 % por bootstrap cola × año.",
        "Brier skill score against the reference class (the zero line). Bars: 95 % interval from the queue × year bootstrap.",
      ),
    },
    sensibilidad: {
      tag: L("Robustez", "Robustness"),
      title: L("Positiva en cada diseño, nunca concluyente", "Positive in every design, never conclusive"),
      lead: L(
        "La ganancia de la combinación se repite al cambiar la referencia, la ventana, el tamaño de bloque o al reservar los últimos orígenes. Cambia el tamaño, no el signo, y en ningún diseño el intervalo al 95 % excluye el cero.",
        "The blend's gain recurs when the reference, the window, the block size change, or when the latest origins are held out. The size changes, not the sign, and in no design does the 95 % interval exclude zero.",
      ),
      subLead: L(
        `Por tipo de cola a cinco años, la combinación ayuda en las familiares (${t("fSgFamFive")}, ${t("fSgFamFiveCi")}) y no en las de empleo (${t("fSgEmpFive")}, ${t("fSgEmpFiveCi")}); en FAD (${t("fSgFadFive")}) más que en DFF (${t("fSgDffFive")}).`,
        `By queue type at five years, the blend helps in family queues (${t("fSgFamFive")}, ${t("fSgFamFiveCi")}) and not in employment ones (${t("fSgEmpFive")}, ${t("fSgEmpFiveCi")}); in FAD (${t("fSgFadFive")}) more than in DFF (${t("fSgDffFive")}).`,
      ),
    },
    mapa: {
      tag: L("Dónde ayuda", "Where it helps"),
      title: L("Brecha × horizonte", "Gap × horizon"),
      lead: L(
        "Cada celda da el BSS puntual de la combinación frente a la referencia y, debajo, la tasa base: qué fracción de esas brechas se cubrió dentro del horizonte. Sin intervalos: describe dónde se separa la combinación de la referencia, no demuestra habilidad.",
        "Each cell gives the blend's point BSS against the reference and, below it, the base rate: the share of those gaps covered within the horizon. No intervals: it shows where the blend departs from the reference, not proven skill.",
      ),
    },
    largo: {
      tag: L("Más allá de cinco años", "Beyond five years"),
      title: L("Después de cinco años sólo hay escenarios", "Beyond five years there are only scenarios"),
      paras: [
        L(
          `A diez y quince años no hay clase de referencia sin fuga, así que no hay vara contra la cual medir. A diez años la simulación obtiene un Brier de ${t("fBSimTen")} contra ${t("fBVelTen")} de la velocidad lineal y ${t("fBRwTen")} de la caminata aleatoria; a quince, ${t("fBSimFifteen")} contra ${t("fBVelFifteen")} y ${t("fBRwFifteen")}: la caminata aleatoria ya le gana a la simulación.`,
          `At ten and fifteen years there is no leakage-free reference class, so there is no yardstick. At ten years the simulation's Brier score is ${t("fBSimTen")} against ${t("fBVelTen")} for linear velocity and ${t("fBRwTen")} for the random walk; at fifteen, ${t("fBSimFifteen")} against ${t("fBVelFifteen")} and ${t("fBRwFifteen")}: the random walk already beats the simulation.`,
        ),
        L(
          `El intervalo simulado del 10 al 90 % cubre la espera real en ${t("fCovCensOne")} de los casos clasificables con brechas de un año, ${t("fCovCensFive")} con brechas de cinco y ${t("fCovCensTwelve")} con brechas de doce, frente a un nominal de 0.80. Por eso toda fecha a más de cinco años se reporta como escenario, no como pronóstico.`,
          `The simulated 10–90 % interval covers the actual wait in ${t("fCovCensOne")} of classifiable cases with one-year gaps, ${t("fCovCensFive")} with five-year gaps and ${t("fCovCensTwelve")} with twelve-year gaps, against a nominal 0.80. That is why any date beyond five years is reported as a scenario, not a forecast.`,
        ),
      ],
    },
    ejemplos: {
      tag: L("Ejemplos trabajados", "Worked examples"),
      title: L("Tres colas del boletín de noviembre de 2026", "Three queues from the November 2026 bulletin"),
      lead: L(
        "Tabla FAD. Probabilidad de que la fecha de prioridad se vuelva vigente dentro de uno, tres y cinco años según la combinación evaluada; a 10, 20 y 30 años, la simulación de la serie como escenario no validado.",
        "FAD table. Probability that the priority date becomes current within one, three, and five years under the evaluated blend; at 10, 20 and 30 years, the series simulation as an unvalidated scenario.",
      ),
      outside: L(
        "Brecha fuera del rango evaluado: sin probabilidad validada, sólo escenario.",
        "Gap outside the evaluated range: no validated probability, scenario only.",
      ),
    },
    limites: {
      tag: L("Límites", "Limits"),
      title: L("Lo que el artículo no afirma", "What the article does not claim"),
      items: [
        L("No afirma que la combinación le gane a la referencia: ningún intervalo excluye el cero.", "It does not claim the blend beats the reference: no interval excludes zero."),
        L("No valida pronósticos a más de cinco años: más allá sólo hay escenarios.", "It does not validate forecasts beyond five years: past that there are only scenarios."),
        L("No modela la demanda por día de prioridad ni la contabilidad de cupos; esas fuentes públicas son incompletas.", "It does not model demand per priority day or quota accounting; those public sources are incomplete."),
        L("Los intervalos son aproximados: los orígenes vecinos comparten parte de su horizonte.", "The intervals are approximate: neighbouring origins share part of their horizon."),
      ],
    },
    estado: {
      tag: L("Estado", "Status"),
      title: L("Manuscrito listo, envío pendiente", "Manuscript ready, submission pending"),
      paras: [
        L(
          "El manuscrito en inglés y su versión en español están terminados, con todas las cifras generadas por código desde los resultados sellados y una integración continua que lo verifica en cada cambio.",
          "The English manuscript and its Spanish version are complete, with every number generated by code from the sealed results and continuous integration that checks it on every change.",
        ),
        L(
          "Falta la revisión del director, el depósito del paquete de reproducibilidad con DOI y el envío a la revista. Esta página no acredita envío ni aceptación: cuando ocurran, se registrarán aquí.",
          "The advisor's review, the deposit of the reproducibility package with a DOI and the submission to the journal remain. This page does not certify submission or acceptance: when they happen, they will be recorded here.",
        ),
        L(
          "Un registro prospectivo de pronósticos se sellará el día del envío y se evaluará en público a partir de 2028.",
          "A prospective forecast registry will be sealed on the day of submission and scored in public from 2028.",
        ),
      ],
    },
  };

  const faq = [
    {
      q: L("¿De qué trata el artículo científico de VisaPredict AI?", "What is the VisaPredict AI scientific article about?"),
      a: L(
        `Pronostica la probabilidad de que una fecha de prioridad del Visa Bulletin se vuelva vigente dentro de K años (tiempo de primer paso), con ${t("fBulletins")} boletines y ${t("fSeriesUsed")} series. Concluye que la clase de referencia de brechas pasadas es el pronóstico a vencer y que más allá de cinco años sólo hay escenarios.`,
        `It forecasts the probability that a Visa Bulletin priority date becomes current within K years (first passage), using ${t("fBulletins")} bulletins and ${t("fSeriesUsed")} series. It concludes that a reference class of past gaps is the forecast to beat and that beyond five years there are only scenarios.`,
      ),
    },
    {
      q: L("¿Qué tan confiables son las calculadoras de fecha que dividen la brecha entre el avance promedio?", "How reliable are date calculators that divide the gap by the average advance?"),
      a: L(
        `Son claramente peores que la clase de referencia en todo horizonte evaluado: índice de habilidad de Brier de ${t("fSVelOne")} a un año (${t("fSVelOneCi")}), ${t("fSVelThree")} a tres y ${t("fSVelFive")} a cinco (${t("fSVelFiveCi")}).`,
        `They are detectably worse than the reference class at every evaluated horizon: Brier skill score of ${t("fSVelOne")} at one year (${t("fSVelOneCi")}), ${t("fSVelThree")} at three and ${t("fSVelFive")} at five (${t("fSVelFiveCi")}).`,
      ),
    },
    {
      q: L("¿La combinación del artículo mejora a la clase de referencia?", "Does the article's blend improve on the reference class?"),
      a: L(
        `Un poco y sin certeza: BSS de ${t("fSBlendOne")} ${t("fSBlendOneCi")} a un año, ${t("fSBlendThree")} ${t("fSBlendThreeCi")} a tres y ${t("fSBlendFive")} ${t("fSBlendFiveCi")} a cinco. Es positiva en todo análisis de sensibilidad, pero ningún intervalo excluye el cero; la ganancia está acotada por ${bounds.join(", ")}.`,
        `Slightly and without certainty: BSS of ${t("fSBlendOne")} ${t("fSBlendOneCi")} at one year, ${t("fSBlendThree")} ${t("fSBlendThreeCi")} at three and ${t("fSBlendFive")} ${t("fSBlendFiveCi")} at five. It is positive in every sensitivity analysis, but no interval excludes zero; the gain is bounded by ${bounds.join(", ")}.`,
      ),
    },
    {
      q: L("¿Por qué el artículo no da fechas a 10, 20 o 30 años?", "Why does the article not give dates 10, 20 or 30 years out?"),
      a: L(
        `Porque el panel no permite validarlas: no hay clase de referencia sin fuga a esos horizontes y el intervalo simulado del 10 al 90 % cubre la espera real sólo en ${t("fCovCensTwelve")} de los casos con brecha de doce años. Se reportan como escenarios.`,
        `Because the panel cannot validate them: there is no leakage-free reference class at those horizons and the simulated 10–90 % interval covers the actual wait in only ${t("fCovCensTwelve")} of twelve-year-gap cases. They are reported as scenarios.`,
      ),
    },
    {
      q: L("¿Qué dice el artículo sobre India EB-2, México F2B y Filipinas F4?", "What does the article say about India EB-2, Mexico F2B and Philippines F4?"),
      a: examples
        .filter((e) => e.evaluated)
        .map((e) =>
          L(
            `${e.name} (corte ${e.cut}, fecha de prioridad ${e.pd}, brecha ${e.gap} años): ${e.blend[2].text} de quedar vigente en cinco años según la combinación; mediana del escenario simulado, ${e.median}.`,
            `${e.name} (cutoff ${e.cut}, priority date ${e.pd}, gap ${e.gap} years): ${e.blend[2].text} chance of becoming current within five years under the blend; simulated scenario median, ${e.median}.`,
          ),
        )
        .join(" "),
    },
    {
      q: L("¿Dónde se publicará el artículo y cuál es su estado?", "Where will the article be published and what is its status?"),
      a: L(
        "El manuscrito está listo para enviarse a una revista indexada (el plan está en la página de Publicación). Falta la revisión del director, el depósito del paquete con DOI y el envío; no hay envío ni aceptación registrados todavía.",
        "The manuscript is ready to be submitted to an indexed journal (the plan is on the Publication page). The advisor's review, the package deposit with a DOI and the submission remain; no submission or acceptance is recorded yet.",
      ),
    },
  ];

  return {
    lang,
    title: front.title,
    shortTitle: front.short_title,
    abstract: front.abstract,
    keywords: front.keywords,
    authors: [
      { name: "Javier Augusto Rebull Saucedo", role: L("Primer autor y autor de correspondencia", "First and corresponding author") },
      { name: "Vicente García Jiménez", role: L("Supervisión y metodología", "Supervision and methodology") },
    ],
    affiliation: L(
      "Departamento de Ingeniería Eléctrica y Computación, Universidad Autónoma de Ciudad Juárez",
      "Department of Electrical and Computer Engineering, Universidad Autónoma de Ciudad Juárez",
    ),
    stats,
    methods,
    horizons,
    long,
    designs,
    subgroups,
    landscape,
    examples,
    sections,
    faq,
  };
}

/** Chunks del RAG (ES y EN) derivados del MISMO modelo que pinta la página. */
export function articleChunks(data) {
  const out = [];
  for (const lang of /** @type {Lang[]} */ (["es", "en"])) {
    const m = articleModel(data, lang);
    const es = lang === "es";
    const lead = es ? "Artículo científico de VisaPredict AI" : "VisaPredict AI scientific article";
    const push = (anchor, title, text) => out.push({ lang, anchor, title: `${lead} · ${title}`, text });
    push("resumen-articulo", es ? "Título, autores y resumen" : "Title, authors and abstract",
      `${m.title}. ${m.authors.map((a) => a.name).join(es ? " y " : " and ")}, ${m.affiliation}. ${m.abstract} ${es ? "Palabras clave" : "Keywords"}: ${m.keywords.join(", ")}.`);
    const s = m.sections;
    push("pregunta", s.pregunta.title, s.pregunta.paras.join(" "));
    push("acto1", s.acto1.title, s.acto1.paras.join(" "));
    push("metodos", s.metodos.title, `${s.metodos.lead} ${m.methods.map((x) => `${x.label}: ${x.desc}`).join(" ")}`);
    push("protocolo", s.protocolo.title, s.protocolo.rules.map((r) => `${r.title}: ${r.text}`).join(" "));
    const tbl = m.horizons
      .map((h) => `${h.label}: ${m.methods.map((x) => `${x.label} ${h.methods[x.id].text} ${h.methods[x.id].ciText}`).join("; ")} (${es ? "casos" : "cases"} ${h.n}, ${es ? "series" : "series"} ${h.series})`)
      .join(". ");
    push("resultados", s.resultados.title, `${s.resultados.paras.join(" ")} ${es ? "Índice de habilidad de Brier frente a la clase de referencia, con intervalo al 95 %" : "Brier skill score against the reference class, with 95 % interval"}: ${tbl}.`);
    push("sensibilidad", s.sensibilidad.title, `${s.sensibilidad.lead} ${m.designs.map((d) => `${d.label}: ${d.points.map((p) => `${p.k} ${es ? "a" : "y"} ${p.text} ${p.ciText}`).join(", ")}`).join(". ")}. ${s.sensibilidad.subLead}`);
    push("largo", s.largo.title, s.largo.paras.join(" "));
    push("ejemplos", s.ejemplos.title, `${s.ejemplos.lead} ${m.examples.map((e) => es
      ? `${e.name}, fecha de prioridad ${e.pd}: corte ${e.cut}, brecha ${e.gap} años. ${e.evaluated ? `Combinación: ${e.blend.map((b) => `${b.text} en ${b.k} ${b.k === 1 ? "año" : "años"}`).join(", ")}.` : s.ejemplos.outside} Escenario simulado: ${e.scenario.map((x) => `${x.text} en ${x.years} años`).join(", ")}; mediana ${e.median}.`
      : `${e.name}, priority date ${e.pd}: cutoff ${e.cut}, gap ${e.gap} years. ${e.evaluated ? `Blend: ${e.blend.map((b) => `${b.text} within ${b.k} ${b.k === 1 ? "year" : "years"}`).join(", ")}.` : s.ejemplos.outside} Simulated scenario: ${e.scenario.map((x) => `${x.text} within ${x.years} years`).join(", ")}; median ${e.median}.`).join(" ")}`);
    push("limites", s.limites.title, s.limites.items.join(" "));
    push("estado", s.estado.title, s.estado.paras.join(" "));
    for (const [i, f] of m.faq.entries()) push(`faq-${i + 1}`, f.q, `${f.q} ${f.a}`);
  }
  return out;
}
