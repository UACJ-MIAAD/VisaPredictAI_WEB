# VisaBot — RAG engineering roadmap (investigación + plan por épocas)

> Investigación exhaustiva del estado del arte de RAG (2024–2026) y de los sistemas
> RAG ganadores/benchmark-topping, con un plan de mejoras por épocas para VisaBot.
> La investigación se hizo con el harness de *deep research* (fan-out de búsquedas →
> verificación adversarial 3-votos por claim → síntesis citada). Fecha: 20-jun-2026.

---

## Parte A — Hallazgos de la investigación (citados, verificados)

Cada hallazgo pasó verificación adversarial (mayoría refuta = se descarta). Confianza alta salvo donde se indica.

### A1 · El patrón ganador: recuperación híbrida + **reranking** (dos etapas)
La arquitectura empíricamente dominante y de mayor ROI es **híbrido (BM25 + denso) fusionado (RRF) y re-puntuado por un cross-encoder reranker**.
- En **T2-RAGBench** (23,088 consultas, texto+tablas financieras), `Hybrid + Cohere Rerank` logró **Recall@5 0.816 / MRR@3 0.605** — el mejor de 10 métodos y el único de dos etapas; superó al híbrido contextual (0.717) y al híbrido RRF (0.695). [arXiv 2604.01733]
- Anthropic reporta que **añadir reranking sobre el híbrido contextual** mejora la reducción de fallos de recuperación (top-20) de **49% → 67%**. [anthropic.com/engineering/contextual-retrieval]
- *Caveat:* T2-RAGBench es un preprint reciente acotado a QA financiero; las cifras de Anthropic son auto-reportadas.

### A2 · **Contextual Retrieval** (Anthropic): el mejor upgrade de indexado
Anteponer a cada chunk un **contexto específico generado por un LLM** *antes de embeber y antes de indexar en BM25*. Escalera de mejora (reducción de fallo de recuperación top-20, base 5.7%):
- Contextual **embeddings** solos: **−35%** (5.7→3.7%)
- Contextual embeddings **+ contextual BM25**: **−49%** (5.7→2.9%)
- **+ reranking**: **−67%** (5.7→1.9%)
- Es un **preprocesado de una sola vez en build, costo de runtime cero**. [anthropic.com/engineering/contextual-retrieval; /news/contextual-retrieval]
- *Caveat:* auto-reportado; la mejora absoluta es de ~2 puntos sobre una base pequeña.

### A3 · El RAG ingenuo deja un hueco grande de robustez
En **CRAG** (Meta, NeurIPS 2024): los mejores LLM solos llegan a ≤34% de exactitud; **añadir RAG de forma directa solo sube a 44%**; las soluciones industriales SOTA responden **solo 63% sin alucinar**. → motiva técnicas correctivas/activas (CRAG, Self-RAG, FLARE) y evaluación de *grounding*. [arXiv 2406.04744] *(el 63% es tasa de no-alucinación, incluye abstenciones honestas.)*

### A4 · Recuperación activa/iterativa: **FLARE**
En vez de recuperar una sola vez al inicio, FLARE predice la siguiente oración y, cuando contiene tokens de baja confianza, usa esa predicción como consulta para **re-recuperar y regenerar** — decide *cuándo* y *qué* recuperar a lo largo de la generación. Útil para generación larga intensiva en conocimiento. [arXiv 2305.06983]

### A5 · Evaluación canónica: **RAGAS**
Marco de referencia con 6 métricas núcleo: **Faithfulness** (todo lo afirmado es inferible del contexto = anti-alucinación), Response Relevancy, **Context Precision**, **Context Recall**, Context Entities Recall, Noise Sensitivity. [docs.ragas.io]

### A6 · Taxonomía canónica (Gao et al.)
Tres paradigmas — **Naive RAG → Advanced RAG → Modular RAG** — y tres componentes: recuperación, generación, aumentación. Es el marco bajo el que se organizan híbrido/reranking/transformación de consulta. [arXiv 2312.10997]

### A7 · En datos texto+tabla, **BM25 a veces supera al denso**
En documentos financieros, BM25 (Recall@5 0.644) supera a `text-embedding-3-large` (0.587); la señal léxica es muy efectiva. El híbrido y el contextual mejoran, pero **ambos quedan por debajo del reranking** (0.816). [arXiv 2604.01733]

### A8 · Reranking "knowledge-aware" (competencia): ganancia **marginal** (confianza media)
Mejoras de reranking sobre `jina-reranker-m0` en multi-documento dan solo R@20 0.61→0.64 / R@5 0.42→0.44. → los refinamientos exóticos de reranking aportan poco. [arXiv 2506.20476]

**Síntesis:** el camino de mayor ROI es **(1) Contextual Retrieval en build (gratis en runtime) + (2) una etapa de reranking**. Lo pesado (SPLADE, ColBERT multi-vector, RAPTOR, GraphRAG, loops agénticos, FLARE) es **probablemente overkill** para un corpus de ~600 chunks.

---

## Parte B — Dónde está VisaBot vs el estado del arte

| Componente SOTA | VisaBot hoy | Brecha |
|---|---|---|
| Híbrido denso+léxico + RRF | ✅ e5-small + BM25 + **RRF** | — |
| Diversificación MMR | ✅ MMR (λ=0.7) | (la mayoría de sistemas no lo tienen; +) |
| **Reranking (cross-encoder)** | ❌ | **falta — el upgrade #1** |
| **Contextual Retrieval** | ❌ (chunks crudos; sí hay metadata source/title) | **falta — barato y alto impacto** |
| Generación citada / grounded | ✅ Claude + citas `[n]` clicables | — |
| Defensa prompt-injection | ✅ 28/28 en eval adversarial | — |
| Transformación de consulta (HyDE, multi-query, reescritura) | ❌ (follow-ups dependen del historial crudo) | falta — ayuda a seriados |
| Correctivo/activo (CRAG/Self-RAG) | parcial (abstención/redirección) | ligero |
| Evaluación retrieval (recall@k/MRR) | ✅ harness propio (recall@6 100%) | — |
| **Evaluación de grounding (RAGAS faithfulness/context-precision)** | ❌ (solo citación+keyword) | falta — para *medir* mejoras |
| Routing (gráfico/glosario/datos) | parcial (`chartForQuery`) | ligero |

VisaBot ya es **Advanced RAG** (híbrido+RRF+MMR+citas). Las brechas reales para llegar a **Modular RAG** de élite son: **reranking, contextual retrieval, transformación de consulta, y evaluación RAGAS**.

---

## Parte C — Plan por épocas (priorizado por impacto-vs-esfuerzo)

> Cada época es independiente y mensurable. `[runtime]` = afecta cada consulta · `[build]` = una vez en el deploy · `[CI]` = solo pruebas.
> Antes de cada época se corre la baseline (Época 0) para **probar la ganancia**.

### Época 0 — Instrumentar para medir (barata, primero) `[CI]`
Sin medir, no sabemos si una mejora sirve (varias técnicas SOTA dan ganancia marginal a 600 chunks).
- **E0.1** Como dev, **añado métricas RAGAS** al harness: *Faithfulness* y *Context Precision/Recall* vía LLM-as-judge (Claude) sobre el set de 112 preguntas. *(AC: reporte con baseline numérica por métrica.)*
- **E0.2** Como dev, **añado nDCG@6 y MRR** a `rag-eval.mjs` (ya tengo recall@6). *(AC: una sola corrida imprime recall@6/MRR/nDCG.)*
- **E0.3** Como dueño, **congelo la baseline** (recall@6, faithfulness, defensa adversarial) como números de referencia.
- *Dónde corre:* CI / local. *Esfuerzo:* bajo. *Impacto:* alto (habilita todo lo demás).

### Época 1 — Contextual Retrieval (el upgrade de indexado #1) `[build]`
Mayor impacto de indexado, **costo de runtime cero** (todo en `build-rag-index.mjs`).
- **E1.1 (tier barato, sin LLM)** Como sistema, **antepongo el contexto estructural** que ya tengo (`fuente — título — sección`) al texto de cada chunk antes de embeber y de tokenizar BM25. Captura buena parte del beneficio gratis. *(AC: index.json con texto contextualizado; recall sube vs baseline.)*
- **E1.2 (tier completo, estilo Anthropic)** Como sistema, en build genero con Claude una frase de contexto por chunk (situándolo en su documento) y la antepongo antes de embeber+BM25. ~600 llamadas haiku una sola vez (con prompt-caching del documento). *(AC: medir −X% en fallo de recuperación vs E1.1.)*
- **E1.3** Como dueño, comparo E1.1 vs E1.2 con Época 0 y **me quedo con el que gane** (a 600 chunks el tier barato puede bastar).
- *Esfuerzo:* medio. *Impacto:* alto. *Decisión:* empezar por E1.1 (gratis).

### Época 2 — Reranking (la segunda etapa del patrón ganador) `[runtime]`
Recupero **top-12** (en vez de 6) y los re-puntúo a **top-6**.
- **E2.1 (recomendado, sin clave nueva)** Como sistema, añado **LLM-as-reranker**: la función Claude (haiku) recibe top-12 y devuelve los 6 más relevantes ordenados, luego genera. Reusa el endpoint actual. *(AC: context-precision sube vs baseline.)*
- **E2.2 (alternativa)** Reranker cross-encoder serverless (Cohere Rerank / Voyage rerank) — requiere clave + costo por consulta.
- **E2.3 (evitar)** Cross-encoder on-device (Transformers.js) — peso/latencia altos; no vale a 600 chunks.
- *Nota honesta:* nuestro recall@6 ya es ~100% en el set actual → la ganancia de precisión será **modesta**; medir en Época 0 antes de comprometer. *Esfuerzo:* medio. *Impacto:* medio (alto en corpus grandes).

### Época 3 — Transformación de consulta `[runtime]`
- **E3.1 (alto valor para seriados)** Como sistema, **reescribo follow-ups a consultas autónomas** antes de recuperar ("¿y India?" → "evolución de la fecha de prioridad de India en F3"), usando el historial + un paso barato de Claude. Mejora directamente los prompts seriados que probamos. *(AC: el caso `ctx-country-followup` recupera la serie correcta sin depender del historial crudo.)*
- **E3.2** **Multi-query / RAG-Fusion**: generar 2-3 variantes de la consulta, recuperar cada una, fusionar con RRF. Sube recall en preguntas ambiguas. *(AC: recall@6 sube en consultas parafraseadas.)*
- **E3.3 (opcional)** **HyDE**: generar una respuesta hipotética y embeberla para recuperar. Útil en consultas difíciles; medir si aporta sobre E3.2.
- *Esfuerzo:* medio. *Impacto:* medio-alto (sobre todo E3.1 para conversación).

### Época 4 — Correctivo / routing ligero (CRAG-lite) `[runtime]`
- **E4.1** **Gate de confianza de recuperación**: si los puntajes top-k caen bajo un umbral, el bot **abstiene/clarifica** explícitamente en vez de responder con contexto débil (versión ligera de CRAG). Ya abstiene en off-topic; formalizarlo con umbral. *(AC: consultas sin buen match piden reformular.)*
- **E4.2** **Query routing**: clasificar la intención (glosario / datos / gráfico / charla) y enrutar (los gráficos ya usan `chartForQuery`; formalizar el router). *(AC: menos respuestas genéricas.)*
- *Esfuerzo:* bajo-medio. *Impacto:* medio.

### Época 5 — Evaluación continua como gate de CI `[CI]`
- **E5.1** Como dueño, **conecto las evals como gate**: el deploy falla si recall@6 < umbral, faithfulness < umbral, o defensa adversarial < 100%. *(AC: PR/deploy bloqueado al regresar.)*
- **E5.2** Ampliar vectores adversariales (Unicode/homoglifos, base64, inyección dentro de documentos subidos).
- *Esfuerzo:* bajo. *Impacto:* alto (evita regresiones; cierra el ciclo).

---

## Parte D — Explícitamente diferido / *overkill* a 600 chunks

La investigación es clara: a esta escala, lo siguiente **no se recomienda** (complejidad/costo > beneficio):
- **SPLADE / sparse aprendido** — BM25 ya da la señal léxica; el corpus es chico.
- **ColBERT / multi-vector (late-interaction)** — índice pesado; injustificable a 600 chunks.
- **RAPTOR (resúmenes jerárquicos)** — útil en miles de docs; aquí innecesario.
- **GraphRAG / KG-RAG** — gran ingeniería; el dominio no requiere razonamiento de grafo multi-hop.
- **Loops agénticos / Self-RAG / FLARE completos** — latencia y costo; la generación de una pasada con buen reranking basta.
- **Reranking "knowledge-aware" exótico (A8)** — ganancia marginal.

Estos quedan documentados como *futuro lejano* solo si el corpus crece 10–100×.

---

## Orden recomendado (resumen ejecutivo)
1. **Época 0** (medir) → 2. **Época 1.1** (contextual barato, gratis) → 3. **Época 3.1** (reescritura de follow-ups, gana en conversación) → 4. **Época 2.1** (LLM-reranker) → 5. **Época 4** (CRAG-lite + routing) → 6. **Época 5** (gate CI). E1.2/E3.2/E3.3 solo si Época 0 muestra que la baseline lo amerita.

Las dos de mayor ROI inmediato — **Contextual Retrieval (build, gratis)** y **medición RAGAS** — se pueden empezar ya sin tocar runtime ni costos.

---

## Resultados medidos (implementación 20-jun-2026)

Se ejecutó el orden recomendado **validando cada paso contra la medición de la Época 0**. La decisión de qué enviar a producción se tomó con datos, no por completitud.

| Época | Estado | Evidencia medida |
|---|---|---|
| **0 — medición** | ✅ enviado | `npm run rag:retr`. Baseline: gloss recall@6 **100%**, recall@1 95%, MRR **0.976**, nDCG@10 0.982; académico source-hit@6 **88%**. |
| **1.1 — Contextual Retrieval** | ✅ enviado | Prefijo estructural **selectivo** (solo `academic`/`docs`; en glosario auto-contenido **diluía** 95→94%). Académico subió de ~75% a **88%** source-hit@6 sin tocar glosario. A/B validado. |
| **3.1 — reescritura de follow-ups** | ✅ enviado | Heurística cliente (gratis): solo aumenta seguimientos claros (`¿y India?`, ≤3 palabras) con el turno previo; preguntas nuevas intactas. En `assistant-console.tsx` y `visabot.tsx`. |
| **5 — gate de CI** | ✅ enviado | `npm run rag:gate` → exit 1 si recall@6 < 1.0, MRR < 0.95, gloss@1 < 0.92, o académico@6 < 0.85. Pasa hoy. |
| **2 — reranking (cross-encoder/LLM)** | ⏸️ diferido con evidencia | recall@6 ya es **100%**: no hay headroom de recuperación que reordenar. La selección de citas en generación ya descarta lo irrelevante (chips solo muestran `[n]` citado). Reactivar si el corpus crece 10×. |
| **4 — CRAG-lite (gate de confianza)** | ⏸️ diferido con evidencia | El rango de cosenos de e5 es comprimido (relevante ~0.85 vs off-topic ~0.80) → umbral fijo frágil, arriesga descartar contexto válido. El grounding actual **ya abstiene** (off-topic refusal 100%, adversarial 28/28). Sin headroom. |
| **3.2/3.3 — multi-query / HyDE** | ⏸️ diferido | Round-trips extra de LLM para ganar recall que ya está al 100%. Sin ROI a esta escala. |

**Conclusión de ingeniería:** a 600 chunks con recall@6=100% y defensa adversarial 28/28, los upgrades de alto ROI son los **baratos de build/cliente** (contextual selectivo, follow-ups, gate de CI). El reranking y las transformaciones de query son *overkill* hoy; quedan documentados y listos para reactivar con crecimiento del corpus.

---

## US I6 — Índice reproducible, temporal y por capas (12-jul-2026, plan auditoría 3 repos)

Implementado en `scripts/build-rag-index.mjs` + `lib/visabot/retrieval-core.mjs` +
`components/visabot/engine.ts`; verificado con los DOS gates (`rag:gate` + golden `--gate`).

### Carga por capas (el navegador ya no baja el monolito)

| Artefacto | Cuándo baja | Peso medido | Presupuesto |
|---|---|---|---|
| `public/rag/chunks.json` | `warmUp()` (pre-consentimiento, BM25) | **394 kB** | ≤600 kB (`rag_preconsent_chunks_kb`) |
| `public/rag/vectors.f16` | `warmUpSemantic()` (solo tras consentimiento) | **494 kB** | ≤800 kB (`rag_vectors_kb`) |
| `public/rag/index.json` | **nunca** (monolito para las evals: golden/selfcheck/rag-eval/injection lo leen local y contra prod) | 1.7 MB | dentro de `rag_index_total_mb` 3.5 |

Antes: `index.json` de **1.60 MB** bajaba COMPLETO en `warmUp()` pre-consentimiento aunque
BM25 no usa vectores. Ahora la descarga pre-consentimiento cae **~75 %** (1.60 MB → 0.39 MB).

**Vectores en float16 con round-trip:** el build cuantiza los embeddings f32 → f16 y los
**desquantiza de vuelta** antes de escribir el monolito de evals, de modo que el navegador
(que decodifica `vectors.f16` con `decodeF16` de retrieval-core) y todas las evals puntúan
**los mismos floats bit a bit** — cero deriva producción/eval. Costo medido de la
cuantización: **ninguno** (MRR 0.982, recall@6 100 %, gloss@1 96 % — idénticos a f32).

### Pins de fuentes y modelo

- **Docs del repo de datos @ SHA del release** (`sourcePin`): el build lee el release
  manifest (`git_sha`) y fetchea los docs RAG en `raw.githubusercontent/.../<sha>/` vía
  `dataRepoRawAt()` de `lib/repo.mjs`. Fallback documentado a `main` SOLO si el manifest no
  responde (o por doc que falte al SHA — se registra en `meta.json → pins.source.fallbacks`).
  El feed de boletines (`bulletins.json`) sigue en `main` **a propósito**: es el feed de
  frescura. `pins.source.coherent` registra si el release de los docs coincide con el corte
  SERVIDO en `/data` (cross-check contra `data-pins.generated.mjs`, US I1).
- **Modelo de embeddings pineado** (`MODEL_PIN`): revision HF + sha256 de los 4 archivos que
  carga el pipeline q8; **verificación sha256 en cada build** (drift ⇒ build FALLA).
  *Límite documentado:* la revision es metadata (pasarla a transformers.js cambiaría el layout
  de caché que el navegador resuelve con `allowRemoteModels=false`); en runtime la integridad
  la da el hosting same-origin + deploy atómico de Netlify (transformers.js no expone hook de
  hash por fetch).

### Metadata temporal por chunk + precedencia determinista

Cada chunk lleva `source_type` (`site_academic` / `repo_doc` / `live_fact`), `release_id`
y `valid_from` (si fechable), y los chunks del MODEL_CARD llevan `temporal: "current"` +
`supersedes: ["capiii","capiv","tablas"]` (las secciones de la propuesta congelada de mayo
que aún dicen "8 modelos" por diseño). `applyTemporalPrecedence` (retrieval-core, unit-
tested) reordena la selección **antes del LLM**: el chunk vigente rankea sobre su superseded
cuando ambos se recuperan para la misma consulta; los históricos **no se borran** del índice.
Con esto el golden ctx recall subió **87.9 % → 90.5 %** y acad@6 **88 % → 92 %**.

### Reproducibilidad (demostrada)

Doble `npm run rag:build` → `chunks.json`, `vectors.f16` y `rag-hashes.json` **byte-idénticos**
(sha256 iguales); `index.json` y `meta.json` idénticos salvo el campo `built` (única exención
de timestamp). `meta.json → layers` publica el sha256 de las capas para auditarlo en prod.
Determinismo asegurado: orden de archivos EN sorteado, sin `Date.now()` en el contenido,
embeddings deterministas (verificado empíricamente).

---

## US I4 — Ablation de chunking semántico y reranker (12-jul-2026): **NO SE ADOPTA**

Criterios de adopción (plan): context precision **+10 % rel.**, recall **−≤2 pts**, p95 **+≤400 ms**.
Métrica de precisión: `context-precision@6` sobre las probes académicas de
`rag-retrieval-eval.mjs` (`--json` emite la tabla; `--rerank <v>` ablata el reranker).

| Variante | recall@6 | MRR | acad@6 | ctx-precision@6 | golden ctx recall | p95 retrieval |
|---|---|---|---|---|---|---|
| **Baseline (shipped)** | 100 % | 0.982 | 92 % | **59.0 %** | **90.5 %** | 1.2 ms |
| Chunking semántico (`VB_CHUNK=semantic`) | 100 % | 0.982 | 92 % | 59.0 % (+0 %) | 89.0 % (**−1.5 pts**) | 0.9 ms |
| Reranker term-coverage (`--rerank cover`) | 100 % | 0.982 | 92 % | **57.7 % (−2.2 % rel)** | — | 1.3 ms |
| Cross-encoder tiny | — | — | — | — | — | rechazado por presupuesto (abajo) |

- **Chunking semántico:** empata TODAS las métricas de retrieval y BAJA el golden ctx recall
  1.5 pts (19→23 hallazgos): el empaquetado por oración deja fuera de contexto hechos que el
  overlap de caracteres sí capturaba. No cumple el +10 % de precisión → **rechazado**. El
  código queda como harness de ablation (`VB_CHUNK=semantic`, con parent/ordinal/offsets en
  meta) para re-medirlo si el corpus crece.
- **Reranker term-coverage:** ctx-precision **empeora** (59.0→57.7 %) — el bonus de cobertura
  amplifica chunks largos off-target. **Rechazado**; queda `--rerank cover` para re-ablatar.
- **Cross-encoder tiny (bge-reranker / mmarco-MiniLM):** rechazado por presupuesto SIN
  ablation completa: pre-consentimiento es imposible por diseño (el gate de consentimiento
  exige CERO descargas de modelo); post-consentimiento añadiría ~30–300 MB de descarga y
  ~0.7–1.2 s por consulta (24 pares × ~30–50 ms en wasm single-thread) sobre una baseline de
  ~1 ms — viola el techo de **+400 ms p95** por un orden de magnitud, para un corpus de ~650
  chunks cuyo recall@6 ya es 100 %. Coincide con la decisión medida de la Época 2 (arriba).
  Re-evaluar solo si el corpus crece 10× o si aparece un CE ≤5 MB multilingüe.

**Estado shipped:** baseline de retrieval intacta + precedencia temporal (I6). Rollback de
cualquier ablation = no pasar el flag (los defaults no cambiaron).
