# Privacidad del RAG / VisaBot — qué sale del navegador y qué no

> Creado en el plan `PLAN_AUDITORIA_TRES_REPOS_MLOPS_CLEAN_CODE_2026-07-12.md` (US I5/J5).
> **Owner:** Javier Rebull. **Fecha:** 2026-07-12. Se revisa junto con
> `docs/THREAT_MODEL.md` (§8: anual + ante cambio de proveedor).

## 1. Principios

1. **Sin cuentas, sin cookies, sin identificadores persistentes.** El sitio no tiene login;
   la analítica (Plausible) es cookieless y no recibe contenido de mensajes.
2. **Lo sensible se queda en el navegador siempre que la función lo permita.** Solo la
   generación con LLM requiere salir del dispositivo.
3. **Cero persistencia propia de conversaciones.** Ni el sitio ni la función guardan
   mensajes; el historial vive en la memoria de la pestaña y muere con ella.

## 2. Qué NO sale nunca del navegador

| Dato | Dónde vive | Evidencia |
|---|---|---|
| Priority date tecleada en la herramienta "¿alcanza mi fecha?" del lightbox | Estado React local (`pd`), sin URL, sin `track()`, sin fetch | `components/sections/forecast-lightbox.tsx` |
| Exploración del panel (filtros, tabla, gráficos) | El CSV se descarga al navegador y se procesa en un Web Worker local | `lib/data/panel-core.ts`, `lib/data/panel-worker.ts` |
| Búsqueda léxica del VisaBot (modo BM25, pre-consentimiento) | Recuperación 100 % en el navegador sobre el índice público `public/rag/` | `lib/visabot/retrieval-core.mjs` |
| Embeddings semánticos (post-consentimiento) | El modelo e5-small corre **on-device** vía onnxruntime-web; la consulta se embebe localmente, nunca se manda a un servicio de embeddings | `components/visabot/engine.ts` (wasm desde `/ort/`, modelo desde `/models/`, same-origin) |

## 3. Qué SÍ sale del navegador, a dónde y por qué

| Dato | Destino | Por qué | Base técnica |
|---|---|---|---|
| Pregunta del usuario + historial breve (cap 12 turnos) + chunks de contexto (corpus público hash-verificado) + descriptores sintéticos estructurados | Netlify Function `chat.mjs` → **Anthropic API** (streaming) | Generar la respuesta con el LLM. Es el ÚNICO flujo que envía texto del usuario fuera del dispositivo | `netlify/functions/chat.mjs`; caps `MAX_QUERY`/`MAX_HISTORY`/`MAX_CTX` |
| IP del cliente (agregada como contador por ventana de tiempo) | Netlify Blobs (store `visabot-rate`) | Rate limiting anti-abuso; la ventana anterior se poda en cada hit | `chat.mjs` (`limitedShared`) |
| Eventos de uso SIN contenido (p. ej. vista de pronóstico) | Plausible | Analítica agregada sin cookies | `lib/analytics.ts` — invariante: ningún evento lleva input del usuario |

**Importante para el usuario:** si escribes tu priority date u otra información personal en el
chat, ese texto viaja a la función y a la Anthropic API para generar la respuesta. El sitio no
lo almacena; el tratamiento en el proveedor se rige por los términos comerciales vigentes de la
Anthropic API (revisados en cada revisión anual del threat model y ante cualquier cambio de
proveedor o modelo). No se envía ningún identificador de usuario junto con el mensaje (no
existen cuentas).

## 4. Consentimiento del motor semántico

- El VisaBot arranca en modo **solo léxico** (BM25, todo local). El motor semántico (~150 MB
  de modelo + wasm) solo se descarga tras un **botón de consentimiento explícito**
  (`localStorage` `vb-semantic-ok`; respeta `saveData`/conexiones 2g).
- La descarga es de **assets estáticos same-origin** (`/models/*`, `/ort/*`): aceptar no envía
  ningún dato del usuario a ningún lado; el costo es ancho de banda y almacenamiento local.
- Revocación: borrar el sitio de datos del navegador (localStorage) vuelve al modo léxico.
- Verificación automatizada: `scripts/visabot-dense-check.mjs` (alias `check:visabot`) exige
  0 requests a `/models` antes del clic y carga solo después.

## 5. Retención

| Quién | Qué retiene | Control |
|---|---|---|
| Este sitio / la función | **Nada** de conversaciones (stateless); Blobs solo contadores IP:ventana efímeros | Por diseño; ver `docs/THREAT_MODEL.md` §4.2–4.3 |
| Netlify | Logs operativos de invocación de Functions (retención estándar del proveedor) | Configuración de la cuenta Netlify |
| Anthropic | Según los términos comerciales de la API vigentes | Revisión anual + ante cambio de proveedor |
| Plausible | Métricas agregadas sin PII | Sin cookies ni IDs persistentes |

## 6. Fallos y degradación (privacidad preservada)

- Sin `ANTHROPIC_API_KEY` o con el upstream caído, la función responde error tipado y el
  cliente cae a **modo extractivo local**: la respuesta se compone en el navegador desde el
  índice, y NADA sale del dispositivo.
- El feed de pronósticos caído ⇒ proyección de deriva local claramente etiquetada como
  ilustrativa (sin llamadas externas adicionales).

## 7. Contacto

Autor y responsable: Javier Rebull — `al263483@alumnos.uacj.mx`. Solicitudes sobre datos:
dado que no se persiste conversación ni existe cuenta alguna, no hay datos de usuario que
borrar en este sitio; para el eslabón del proveedor LLM aplican sus términos comerciales.
