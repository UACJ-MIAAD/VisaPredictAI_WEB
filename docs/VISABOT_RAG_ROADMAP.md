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
