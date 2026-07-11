# Triage de dependencias y política de SLA (G2, plan auditoría 2026-07-11)

Estado del `npm audit --omit=dev` al 2026-07-11: **8 moderadas, 0 altas/críticas**,
que colapsan en **dos causas raíz**. El gate programado
(`.github/workflows/scheduled-quality.yml`, job `security-audit`) falla en
high/critical y reporta las moderadas cada lunes; este documento es su triage vivo.

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

## Triage vigente (2026-07-11)

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
