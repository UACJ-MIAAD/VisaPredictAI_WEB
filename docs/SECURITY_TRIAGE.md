# Triage de dependencias y política de SLA (G2, plan auditoría 2026-07-11 · A5 2026-07-12)

Estado del `npm audit --omit=dev` al 2026-07-12 (re-verificado): **8 moderadas, 0
altas/críticas**, que colapsan en **dos causas raíz**. El gate programado
(`.github/workflows/scheduled-quality.yml`, job `security-audit`) falla en
high/critical y reporta las moderadas cada lunes; este documento es su triage vivo.
El lado Python (locks del repo de datos, 9 avisos aceptados del perfil model) vive en
`VisaPredictAI/docs/SECURITY_TRIAGE.md` con la misma política y fecha de revisión.

**Verificado 2026-07-12 (A5):** `npm audit fix` SIN `--force` no cambia nada
(dry-run JSON: 0 added / 0 removed / 0 changed) — las 8 moderadas requieren bumps
breaking (`@netlify/blobs` 10.x es semver-major; el "fix" de next propone el
downgrade next@9.3.3). Por política, NO se aplican; quedan bajo SLA moderate.

## Política de SLA por severidad

| Severidad | SLA | Acción |
|---|---|---|
| critical | 48 h | Parche o mitigación inmediata; deploy fuera de ciclo si hace falta |
| high | 7 días | PR de upgrade con tests y plan de rollback |
| moderate | 30 días o el siguiente bump del upstream directo (lo que llegue primero), vía PR probado | Triage aquí con explotabilidad y owner |
| low | Mejor esfuerzo | Se agrupa con el siguiente upgrade planificado |

**Prohibido `npm audit fix --force`**: sus "fixes" proponen downgrades destructivos
(hoy: next@9.3.3, tres majors atrás). Todo upgrade va por PR con la suite completa
(vitest + typecheck + build offline) y rollback = revert del commit.

## Triage vigente (2026-07-12)

Los 8 avisos, uno por fila (el detalle de superficie vive en las dos causas raíz de
abajo). Aviso raíz: GHSA-8988-4f7v-96qf (otel) y GHSA-qx2v-qp2m-jg93 (postcss); las
filas sin GHSA propio son paquetes marcados por depender de una versión vulnerable.

| Paquete | Aviso | ¿Nos afecta? | Decisión | Owner | Revisión |
|---|---|---|---|---|---|
| @opentelemetry/core | GHSA-8988-4f7v-96qf (moderate) | BAJA: solo Netlify Functions (proxy VisaBot); ver causa raíz 1 | Accept; esperar bump del upstream directo | Javier | 2026-08-12 |
| @opentelemetry/resources | depende de core vulnerable | Ídem causa raíz 1 | Ídem | Javier | 2026-08-12 |
| @opentelemetry/sdk-trace-base | depende de core/resources vulnerables | Ídem causa raíz 1 | Ídem | Javier | 2026-08-12 |
| @opentelemetry/sdk-trace-node | depende de core/sdk-trace-base vulnerables | Ídem causa raíz 1 | Ídem | Javier | 2026-08-12 |
| @netlify/otel | depende de @opentelemetry/* vulnerables | Ídem causa raíz 1 | Ídem | Javier | 2026-08-12 |
| @netlify/blobs | depende de @netlify/otel vulnerable | Ídem causa raíz 1 (única directa de la cadena) | Accept; bump cuando el fix no sea semver-major (hoy: 10.1.0, breaking) | Javier | 2026-08-12 |
| postcss | GHSA-qx2v-qp2m-jg93 (moderate) | NO explotable: solo build-time sobre CSS propio; ver causa raíz 2 | Accept; llega con el siguiente minor de next | Javier | 2026-08-12 |
| next | depende de postcss vulnerable | Ídem causa raíz 2 (el "fix" de npm es el downgrade next@9.3.3 — prohibido) | Accept; upgrade normal de next con suite completa | Javier | 2026-08-12 |

### 1. `@opentelemetry/core` — asignación de memoria sin cota en W3C Baggage

- **Cadena:** `@netlify/blobs` (directa) → `@netlify/otel` → `@opentelemetry/*`
  (6 de los 8 hallazgos son esta única cadena transitiva).
- **Dónde corre:** solo en las Netlify Functions (el proxy del VisaBot usa Blobs para
  rate-limiting). No entra al bundle del navegador ni al export estático.
- **Explotabilidad real:** BAJA. Un header `baggage` malicioso podría inflar memoria de
  UNA invocación de función (aislada y efímera en serverless); el rate-limit por IP del
  propio proxy acota el volumen. No hay path a datos ni a RCE.
- **Owner:** Javier (bump de `@netlify/blobs` cuando el upstream suba su otel).
- **Acción:** esperar release del upstream directo dentro del SLA moderate; el job
  semanal detecta el fix disponible.

### 2. `postcss < 8.5.10` — XSS por `</style>` sin escapar en output CSS

- **Cadena:** `next` (directa) → `postcss` vendorizado.
- **Dónde corre:** SOLO en build time, procesando el CSS propio del repo (Tailwind).
  No procesa CSS de terceros ni input de usuario; el sitio exportado no incluye postcss.
- **Explotabilidad real:** NO explotable en este pipeline (requeriría CSS atacante en
  el árbol de fuentes, que ya implicaría compromiso del repo).
- **Owner:** Javier (bump de `next` en el siguiente minor que actualice su postcss).
- **Acción:** SLA moderate vía upgrade normal de next con suite completa.

## Cobertura relacionada

- **Secretos:** ni `ci.yml` ni `scheduled-quality.yml` usan secreto alguno (el índice
  RAG se construye de fuentes públicas; el audit lee el lockfile).
- **Fallo de API → fallback extractivo:** el comportamiento existe
  (`components/visabot/engine.ts`) pero **no tiene test dedicado** — gap registrado
  para G3 (cobertura por riesgo: "web cubre … fallbacks").
- **Acciones de CI:** pinneadas por SHA en ambos workflows.
