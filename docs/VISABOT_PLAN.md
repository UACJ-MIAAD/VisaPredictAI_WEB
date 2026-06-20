# VisaBot — Plan de implementación (user stories)

> Asistente conversacional para `visapredictai.com`. **RAG legítimo y canónico**,
> **cero hardcoded**, alimentado automáticamente desde el repo principal
> `UACJ-MIAAD/VisaPredictAI` y desde el contenido académico del propio sitio.
> Inspirado en EpiBot (EpiForecast-IMSS-Dashboard) pero superándolo en cada eje:
> RAG real (no handlers a mano), formato y UX de primera, y conocimiento que se
> regenera solo en cada build.
>
> Autor: Javier Rebull · MIAAD UACJ · jun-2026.

---

## 0. Por qué EpiBot NO es suficiente (y qué heredamos)

| Eje | EpiBot | VisaBot (este plan) |
|---|---|---|
| Cerebro | 22 *handlers* escritos a mano + RAG Gemini como *fallback* | **RAG de verdad** como vía principal: chunking → embeddings densos + BM25 → fusión RRF → MMR → generación citada |
| Conocimiento | `knowledge.json` curado a mano + chunks ad-hoc | **Generado en build** desde el repo de datos (GitHub raw) + contenido académico del sitio. **0 hechos escritos a mano** |
| Embeddings | API Gemini (clave + costo, vendor lock-in) | **Locales** (Transformers.js, modelo multilingüe auto-hospedado). 0 clave para recuperar |
| Generación | Gemini | **Claude** (Anthropic), vía función Netlify mínima. Único secreto: `ANTHROPIC_API_KEY` |
| Actualización | re-build manual del índice + redeploy | **Automática**: `prebuild` reconstruye el índice desde el repo en cada deploy; el cron del repo de datos puede disparar un *build hook* |
| Formato | bueno | **editorial**, tokens del sitio, bilingüe ES/EN sin flash, citas con *deep-link* a la sección exacta, *streaming*, accesible, móvil, voz opcional |
| Degradación | "solo datos locales" | **modo extractivo** citado si no hay clave LLM — el bot sigue siendo útil y honesto |

Heredamos de EpiBot las buenas ideas de UX: panel con *suggested prompts*, indicador
de escritura, *streaming*, chips de fuente, copiar, voz, *scroll-to-bottom*,
sanitización de markdown. Lo que NO heredamos: el cableado de conocimiento a mano.

---

## 1. Arquitectura (resumen)

```
BUILD (Node, sin claves)                RUNTIME (navegador)            EDGE (Netlify Fn)
─────────────────────────              ─────────────────────          ──────────────────
scripts/build-rag-index.mjs            components/visabot/*           netlify/functions/chat.mjs
  fetch repo datos (raw GitHub)  ──┐    1. abre panel (lazy)            recibe {query,context,history}
  + contenido académico local    │     2. carga índice + modelo        prompt grounded + citas
  → trocea + embeddings (e5)     ├──▶  3. embeber consulta (local)  ──▶ Claude Messages (stream)
  → public/rag/index.json        │     4. híbrido: coseno+BM25→RRF→MMR   relay SSE
  → public/rag/suggestions.json  │     5. POST contexto a la Fn       (sin clave → 503 → extractivo)
  → public/models/<modelo>     ──┘     6. render stream + chips fuente
```

**Decisiones canónicas (RAG bien hecho):**
- **Recuperación híbrida**: densa (coseno sobre embeddings) + léxica (BM25 Okapi) fusionadas con **Reciprocal Rank Fusion (RRF)**.
- **Diversidad**: **MMR** (Maximal Marginal Relevance) para no devolver 6 chunks casi idénticos.
- **Chunking con estructura**: el glosario y las referencias se trocean **atómicamente** (1 chunk por término / por referencia); el cuerpo académico por encabezado+párrafo con solape.
- **Grounding estricto**: el sistema responde **solo** desde el contexto recuperado y **cita** `[n]`; si no está, lo dice.
- **Citas con *deep-link***: cada chunk conoce su sección y ruta (`/anteproyecto#capii`, etc.) → los chips llevan a la fuente exacta.

**Modelo de embeddings:** `Xenova/multilingual-e5-small` (384-d, multilingüe ES/EN,
~33 MB cuantizado). Auto-hospedado en `public/models/` (CSP limpia, sin CDN externo).
Carga perezosa al abrir el bot; cacheado por el navegador tras la 1ª vez.

**Modelo de generación:** `claude-haiku-4-5` por defecto (rápido/barato), configurable
con `VISABOT_MODEL`.

---

## 2. User stories

### Épica A — Motor de conocimiento (build, cero hardcoded)

- **A1** · Como sistema, **construyo el índice RAG en `prebuild`** para que el conocimiento se regenere en cada deploy sin intervención.
  - *AC*: `npm run build` ejecuta `build-rag-index.mjs`; si falla la red, no rompe el deploy (try/catch + warning) y el sitio queda con el último índice válido o un estado "construyéndose".
- **A2** · Como sistema, **leo el contenido académico local** (`content/source.html` ES + `content/en/*.html`) y lo troceo, para que TODO el anteproyecto sea consultable.
  - *AC*: chunks con `lang`, `source`, `sourceId`, `url` (deep-link a la sección vía site-map), `title`, `kind`.
- **A3** · Como sistema, **troceo el glosario atómicamente** (`.gloss-item[data-k]` → término + acrónimo + definición) y **las referencias** (`li.ref-item[data-n]`), para citas precisas.
- **A4** · Como sistema, **traigo documentación del repo de datos** por GitHub raw (`docs/data_dictionary.md`, `schema.sql`, `README.md`, `docs/example_queries.sql`, `reports/mega_audit_report.md`) y la troceo, para explicar el modelo de datos y la calidad. Cada fuente se salta con warning si 404.
- **A5** · Como sistema, **traigo hechos vivos** de `data/processed/bulletins.json` (último mes, avances/retrocesos por serie) y genero chunks-hecho, para responder "¿qué cambió este mes?".
- **A6** · Como sistema, **computo embeddings densos** (e5-small, prefijo `passage:`) y los serializo compactos (base64 Float32) en `public/rag/index.json`.
- **A7** · Como sistema, **derivo *suggested prompts*** (de términos del glosario, títulos de sección y último boletín) a `public/rag/suggestions.json` — **no** se escriben a mano.
- **A8** · Como sistema, **dejo `public/rag/` y `public/models/` en `.gitignore`** (regenerables); el índice nunca se comitea.

### Épica B — Recuperación en el navegador (RAG canónico)

- **B1** · Como usuario, al abrir el bot **se carga el índice y el modelo de forma perezosa** con progreso visible, para no penalizar la carga del sitio.
- **B2** · Como sistema, **embebo la consulta localmente** (e5, prefijo `query:`) — sin llamadas a APIs de embeddings.
- **B3** · Como sistema, **recupero híbrido**: top-N coseno + top-N BM25 → **RRF** → **MMR** (λ≈0.7) → top-k (≈6), para contexto diverso y relevante.
- **B4** · Como sistema, **filtro por idioma activo** con respaldo cruzado si falta cobertura, para responder en ES o EN coherentemente.
- **B5** · Como sistema, BM25 se construye en el cliente al cargar (tokenización + idf), para no inflar el JSON con TF por chunk.

### Épica C — Generación citada (función Netlify + Claude)

- **C1** · Como sistema, **envío {query, history, context} a `/.netlify/functions/chat`**, que arma un *prompt* grounded y llama a **Claude con streaming**, relayado como SSE.
- **C2** · Como usuario, **veo la respuesta en streaming** con markdown y **chips de fuente `[n]`** que enlazan a la sección citada.
- **C3** · Como sistema, **si no hay `ANTHROPIC_API_KEY`** (503 `no_key`) **caigo a modo extractivo**: compongo respuesta desde los mejores chunks, citada, con aviso honesto.
- **C4** · Como sistema, **el prompt prohíbe inventar**: responder solo desde el contexto; si no está, decir "no lo encuentro en la documentación del proyecto".
- **C5** · Como dueño, **valido la entrada** (longitud, *rate-limit* suave por IP en memoria) y **nunca filtro el secreto**.

### Épica D — UX/UI de primer nivel

- **D1** · Como usuario, veo un **lanzador flotante** elegante (abajo-derecha) coherente con la identidad del sitio; respeta `prefers-reduced-motion`.
- **D2** · Como usuario, abro un **panel** (drawer en móvil, *card* en escritorio) con cabecera, historial, *suggested prompts*, input y acciones.
- **D3** · Como usuario, tengo **prompts sugeridos** (de A7), **nueva conversación**, **copiar mensaje**, **detener generación**, **scroll-to-bottom**, **indicador de escritura**.
- **D4** · Como usuario, todo es **bilingüe** vía `useLang()`/`tr()` (cadenas nuevas en `lib/i18n.ts`), sin flash.
- **D5** · Como usuario, el bot **respeta tema claro/oscuro** usando solo tokens (`--color-*`), sin colores hardcodeados.
- **D6** · Como usuario en móvil, el panel es **full-height seguro** (safe areas), sin overflow, teclado-amistoso.
- **D7** · Como usuario de teclado/lector, hay **focus trap**, `aria-*`, `role="dialog"`, Esc para cerrar, `aria-live` en el log.
- **D8** · Como usuario, puedo **dictar por voz** (Web Speech API, opcional) y **escuchar** la respuesta (TTS) — degradación silenciosa si no hay soporte.
- **D9** · Como dueño, registro **eventos Plausible** (`track`): abrir, preguntar, fallback, voz, clic en fuente.

### Épica E — Seguridad, infra y cierre

- **E1** · Como dueño, **actualizo CSP** en `netlify.toml`: `script-src` += `'wasm-unsafe-eval'`; `worker-src 'self' blob:`; `microphone=(self)` para voz. (El modelo y el índice son *same-origin* → `connect-src 'self'` ya basta; la función es *same-origin*.)
- **E2** · Como dueño, documento las variables (`ANTHROPIC_API_KEY`, opcional `VISABOT_MODEL`) y el *build hook* opcional.
- **E3** · Como dev, `npm run typecheck` y `npm run build` pasan; el índice se genera real y el modo extractivo funciona **sin clave** (verificable esta noche).
- **E4** · Como dev, dejo un **self-check** del motor de recuperación (script que corre una consulta y verifica que recupera el chunk correcto).

---

## 3. Contratos (locked)

**`public/rag/index.json`**
```jsonc
{
  "model": "Xenova/multilingual-e5-small",
  "dim": 384,
  "built": "<ISO>",
  "chunks": [{ "id","lang","source","sourceId","url","title","text","kind" }],
  "vectors": "<base64 Float32 LE, length = chunks.length * dim>"
}
```
`kind ∈ {academic, glossary, reference, docs, data, fact}`.

**`public/rag/suggestions.json`** → `{ "es": string[], "en": string[] }`

**Función** `POST /.netlify/functions/chat`
```jsonc
// req
{ "lang":"es|en", "query":"...", "history":[{"role":"user|assistant","content":"..."}],
  "context":[{"n":1,"title":"...","source":"...","url":"...","text":"..."}] }
// resp: text/event-stream
data: {"t":"delta","text":"..."}
data: {"t":"done"}
data: {"t":"error","code":"no_key|rate|bad_request|server"}
```

---

## 4. Archivos (nuevos / tocados)

```
NUEVOS
  scripts/build-rag-index.mjs          motor de conocimiento (A)
  scripts/rag-selfcheck.mjs            self-check de recuperación (E4)
  netlify/functions/chat.mjs           generación citada con Claude (C)
  components/visabot/visabot.tsx        lanzador + panel (D)
  components/visabot/engine.ts          carga índice/modelo, híbrido, fallback (B,C)
  components/visabot/markdown.tsx       render markdown seguro (marked+dompurify)
  components/visabot/types.ts           tipos compartidos
  docs/VISABOT_PLAN.md                  este plan
TOCADOS
  package.json                          deps + scripts (build:rag, prebuild)
  lib/i18n.ts                           cadenas del bot (ES/EN)
  components/site-shell.tsx             monta <VisaBot/>
  netlify.toml                          CSP + Permissions-Policy
  .gitignore                            public/rag, public/models
```

**Dependencias nuevas:** `@huggingface/transformers` (embeddings build+cliente),
`marked` + `dompurify` (render seguro de markdown en streaming).

---

## 5. Orden de ejecución

1. Plan (este doc) ✓ → 2. deps + .gitignore → 3. `build-rag-index.mjs` → 4. correr y
generar índice real (test) + `rag-selfcheck.mjs` → 5. `chat.mjs` → 6. `engine.ts` +
`markdown.tsx` + `types.ts` → 7. `visabot.tsx` → 8. i18n → 9. montar en shell →
10. CSP/Permissions/.gitignore → 11. `typecheck` + `build` + verificación visual del
modo extractivo → 12. README/notas + checklist de claves.

*No detenerse hasta que `build` pase y el bot responda en modo extractivo sin clave.*
