# Triage de dependencias y política de SLA (G2, plan auditoría 2026-07-11 · A5 2026-07-12 · cierre H1/B4 2026-09-02)

Estado del `npm audit` al 2026-09-02 (verificado sobre `main@9d0929d`): **0 avisos en
todas las severidades**, con y sin `devDependencies` (`npm audit --omit=dev
--audit-level=high` sale 0). El gate programado (`.github/workflows/scheduled-quality.yml`,
job `security-audit`) falla en high/critical y reporta las moderadas cada lunes; este
documento es su triage vivo. El lado Python (locks del repo de datos) vive en
`VisaPredictAI/docs/SECURITY_TRIAGE.md` con la misma política y fecha de revisión.

**Línea base real que cerró este triage (run `33434549803` del job `security-audit`,
registrada el 1-sep-2026 al abrir la higiene post-A7): 17 avisos de producción, 10 high y
7 moderate, 0 critical.** El triage anterior ("8 moderadas", 2026-07-12) había quedado
obsoleto: el audit semanal ya reportaba high sin dueño. Se conserva la política; el triage
histórico se retira de este documento (queda en el historial de git).

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

## Triage vigente (2026-09-02): sin avisos abiertos

No hay filas de triage: el audit completo es 0/0/0/0/0. La próxima fila la abre el job
semanal cuando aparezca un aviso nuevo; el SLA de la tabla anterior aplica desde esa fecha.

### Remediación H1 (PR #2, squash → `main@9d0929d`, 2026-09-02)

Los 17 avisos colapsaban en cinco cadenas; todas se cerraron con upgrades reales, ninguna
con `--force` ni con excepción:

| Cadena (línea base) | Severidad | Remediación |
|---|---|---|
| `next` (DoS en Server Actions del App Router; SSRF en Server Actions) → `postcss` vendorizado (XSS por `</style>`; lectura arbitraria de archivos) | high | `next` → `^15.5.25`; override `postcss` → `^8.5.26` |
| `@netlify/blobs` → `@netlify/dev-utils` → `image-size` (DoS en parsers ICNS/JXL/HEIF) y `@netlify/otel` → `@opentelemetry/*` (asignación sin cota en W3C Baggage) | high + moderate | `@netlify/blobs` → `^10.7.13` (arrastra otel/dev-utils/image-size corregidos) |
| `@huggingface/transformers` → `sharp` 0.34.x anidado (CVEs heredados de libvips, CVE-2026-33327) y `onnxruntime-node` → `adm-zip` (ZIP que fuerza 4 GB de memoria) | high | `sharp` `^0.35.4` como `devDependency` + `overrides` `sharp` → `^0.35.4` y `adm-zip` → `^0.6.0` (el `sharp` anidado desaparece del lockfile) |
| `dompurify` (bypass de `CUSTOM_ELEMENT_HANDLING`; subárbol suelto tras `IN_PLACE`) | moderate | `dompurify` → `^3.4.14` |
| `nanoid` (bucles infinitos con tamaños negativos/custom) y `protobufjs` (DoS por bucle en `.proto`) | high + moderate | lockfile regenerado: `nanoid` 3.3.18, `protobufjs` 7.6.6 |

- `brace-expansion` y `js-yaml` se actualizaron en el lockfile **como dev-only** y así se
  conservan: no forman parte de la superficie de producción (`--omit=dev`).
- Verificación: `npm ci` reproducible (lockfile v3, Node 22.23.2 / npm 10.9.8); suite web
  (vitest + typecheck + build offline) verde en la PR; CI de push `33590123625` verde;
  **Scheduled quality `33592819714` verde** sobre `main@9d0929d` (ejecución manual del
  2-sep-2026 tras el merge); readback local `npm audit --json` → `{info:0, low:0,
  moderate:0, high:0, critical:0}`.
- Evidencia de la remediación (auditoría antes/después, diff del lockfile, clasificación de
  los rojos): `Anteproyecto/Prompts/HIGIENE_2026-09-01/` (fuera de este repo).

## Cobertura relacionada

- **Secretos:** ni `ci.yml` ni `scheduled-quality.yml` usan secreto alguno (el índice
  RAG se construye de fuentes públicas; el audit lee el lockfile).
- **Fallo de API → fallback extractivo:** el comportamiento existe
  (`components/visabot/engine.ts`) pero **no tiene test dedicado** — gap registrado
  para G3 (cobertura por riesgo: "web cubre … fallbacks").
- **Acciones de CI:** pinneadas por SHA en ambos workflows.
