# Triage de dependencias y política de SLA (G2, plan auditoría 2026-07-11 · A5 2026-07-12 · cierre H1/B4 2026-09-02 · #62 2026-10-12)

Estado vigente: ver **«Candidato local C3 (2026-10-20)»** más abajo. El gate
`--omit=dev --audit-level=high` permanece sin cambios. El candidato aún no acredita
CI remoto ni despliegue. Al 2026-09-02 (`main@9d0929d`) el audit era 0 en todas las
severidades. El gate programado (`.github/workflows/scheduled-quality.yml`,
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

## Actualización del runtime RAG (2026-10-22)

El candidato usa Transformers 4.3.1 y ONNX Runtime Node 1.30.0. La dependencia
global-agent 4.1.3 elimina roarr y sprintf-js de la cadena; el audit del lock
de producción pasa de cinco paquetes moderados a **cero avisos**. No se usa
`audit fix --force`, un downgrade de Next ni una supresión de advisories.

La contraparte web de ONNX incluida por upstream aumenta el WASM servido a
25.7 MB sin comprimir. El presupuesto de ese artefacto opt-in pasa deliberadamente
de 25 a 26 MB para esta actualización de seguridad. Los presupuestos de JavaScript,
datos, índice y vectores no cambian. La descarga del modelo y WASM conserva su
puerta de consentimiento y debe verificarse en Chromium, junto con build real,
RAG, cobertura y suite E2E. El aumento es un coste del runtime, no una reducción
del corpus ni de los umbrales de recuperación. Sólo se integra con esos gates verdes.

Como `/ort/*` lleva caché immutable, el módulo MJS y el WASM se solicitan con la
misma revisión del runtime en sus URLs. El build exige que esa revisión coincida
con la versión instalada. Las sondas de navegador reproducen las dos mezclas de
caché antigua/nueva que antes dejaban el motor sin activar; no basta comprobar
sólo un perfil limpio. La pareja antigua completa se conserva como control benigno.

Vitest y coverage-v8 se fijan conjuntamente en 4.1.12, que retira los avisos
moderados del registro manual de mocks y del recorrido de rutas de Windows.
Npm 10 reproduce el fallo interno `edgesOut` al resolver esos peers: sólo la
resolución se hizo con npm 11.6.2 aislado; el lock se normalizó con npm 10 y la
instalación limpia de validación usa Node 22.19/npm 10.9.3, igual que el CI.

El audit completo sigue distinguiendo dependencias de desarrollo. La cadena
braces de ESLint no tiene versión corregida publicada; no se aplica el downgrade
destructivo que sugiere npm. Su alcance y dueño siguen en el triage inferior.
El resultado de producción cero no se presenta como audit completo limpio.

## Registro histórico del candidato C3 (2026-10-20)

Inventario nuevo sobre el lock exacto: la base web `88cb073` presenta **15 paquetes
afectados por 5 GHSA distintos**; producción tiene 6 paquetes y 2 GHSA, sin altos
ni críticos. Tras la corrección quedan **10 paquetes y 2 GHSA**; producción, 5
paquetes de una sola cadena moderada. Son conteos de paquetes y advisories distintos.
No se declara un audit completamente limpio ni se acepta riesgo por el autor.

| Corrección | Versión final | Alcance y validación exigida |
|---|---|---|
| GHSA-238p-pmpm-9mq7, KaTeX | 0.18.2 | mínima versión corregida; build real, fórmulas, export y E2E |
| GHSA-82fw-gwwq-j7x9, Vitest/mocker | 4.1.11, incluido coverage-v8 | parche de la misma línea; unitarias y pisos de cobertura |
| GHSA-698v-4r3x-3vcv, Vite | 8.3.4 | resuelto dentro del rango de Vitest; sin ignorar peers |

Npm 10.9.3 falló con `edgesOut` al resolver los peers del lock anterior. Se usó
npm 11.6.2 aislado únicamente para resolver, y después npm 10 normalizó dos entradas
opcionales `@emnapi`. **La instalación limpia final usa npm 10.9.3 / Node 22.19**,
como el CI; no se cambia el runtime de la aplicación ni se usa `--legacy-peer-deps`
o `--force`. Transformers, ONNX Runtime, Next y sharp conservan sus versiones.

| Aviso todavía presente | Cadena y alcance | Control comprobable / dueño |
|---|---|---|
| GHSA-vfj7-8cjw-p6xm, high | `eslint-config-next` → plugin Next → `fast-glob` → `micromatch` → `braces` 3.0.3; sólo desarrollo | El uso de fast-glob en el plugin está en la resolución de `settings.next.rootDir`; sin ese ajuste devuelve el cwd sin expandir globs. La configuración del proyecto no toma patrones de usuarios. Conservar ese límite y actualizar cuando exista parche. Dueño: mantenimiento del web / Javier. No es un aviso alto de producción. |
| GHSA-hp3w-g68c-fv3c, moderate | Transformers → `onnxruntime-node` → `global-agent` → `roarr` → `sprintf-js` 1.1.3 | En ONNX Node, global-agent se importa en `script/install.js` para el proxy de descarga, no en su entrada de inferencia. El export estático y las funciones del portal no importan ese instalador. No introducir formatos de logging de usuarios ni dependencias de ese instalador en funciones. Dueño: mantenimiento del web / Javier; SLA moderado vigente. |

El registro npm consultado el 20-oct sigue publicando braces 3.0.3 y sprintf-js
1.1.3 como últimas versiones: no hay parche publicado que instalar. Los límites
anteriores reducen el alcance, no eliminan las dependencias ni su aviso. Cualquier
excepción o aceptación adicional corresponde al autor sobre este inventario concreto.

Acciones: `upload-artifact` v7.0.2 y `cache` v6.1.0 fijadas a commits oficiales,
ambas con runtime Node 24 comprobado en `action.yml`. Los jobs se fijan a
`ubuntu-24.04`; se conserva Node 22 para la aplicación. El runner hospedado debe
soportar Node 24 (cache documenta mínimo 2.327.1). Las entradas/salidas, permisos y
gates se conservan; la comprobación remota se hará sobre el commit integrado.

Evidencia local y resolución de tags/runtimes:
`Anteproyecto/Prompts/lote_C3_CI_SEGURIDAD_2026-10-20/`. La verificación local y el
resultado del CI remoto se registran por separado. El triage Python y las demás
historias de cierre conservan su propio alcance.

## Triage 2026-10-12 (histórico)

El job semanal falló desde el 14-sep: ese día por un `ETIMEDOUT` al instalar
`onnxruntime-node` (red, no audit) y desde el 21-sep por avisos nuevos. Audit medido el
2026-10-12 con Node 22.19 / npm 10.9.3 sobre el lock de `main@3ae16ff`: **producción
(`--omit=dev`) 15 avisos únicos en 11 paquetes, 4 high**; con dev, 20 únicos. El gate
salía rc 1. Remediación (lockfile regenerado con npm, sin `--force` ni excepciones):

| Cadena | Avisos | Remediación |
|---|---|---|
| `@huggingface/transformers` → `onnxruntime-node` → `adm-zip` 0.6.0 | 7 (4 high, 3 moderate), incluidos los 7 de `adm-zip` del 5-oct | override `adm-zip` → `^0.6.1`. GHSA-vwc7-r8mq-g2x9 declara afectado `>=0.5.9 <=0.6.0` **sin versión parcheada**: 0.6.1 queda fuera del rango, la ficha no la nombra como corrección |
| `sharp` 0.35.4 (librsvg, CVE-2026-96889) | GHSA-wq5f-xc86-pv6w (high) | `sharp` y su override → `^0.35.5` (+ `@img/*` 0.35.5 / libvips 1.3.4) |
| `postcss`/`@tailwindcss/node`/`magicast` → `source-map-js` 1.2.1 | GHSA-68fv-2mgg-jv7q (high) | `source-map-js` 1.2.2 dentro de rango (sólo lock) |
| `next` 15.5.25 (envenenamiento de caché SSG/ISR auto-hospedado; el export estático no lo usa) | GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p (moderate) | `next` → `^15.5.27` (parche de la misma major) |
| `dompurify` 3.4.14 (`IN_PLACE` + hooks; la app usa modo cadena sin hooks) | GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2 (low) | `dompurify` → `^3.4.16` |
| `brace-expansion` (dev) | GHSA-6j4f, GHSA-qhr7 (high), GHSA-q2hr (moderate) | 1.1.21 / 5.0.12 dentro de rango (sólo lock) |

Después: `npm audit --omit=dev --audit-level=high` **rc 0**; producción 2 avisos únicos
(6 paquetes en la cadena), ninguno high. Abiertos, con dueño:

| Aviso | Paquete (alcance) | Severidad | Explotabilidad | Plan / SLA |
|---|---|---|---|---|
| GHSA-hp3w-g68c-fv3c | `sprintf-js` 1.1.3 vía `onnxruntime-node` → `global-agent` → `roarr` (prod) | moderate | DoS por especificador de precisión; los formatos los fija la biblioteca de logging, no un usuario | **sin versión parcheada** publicada; revisar en cada lunes y al subir `onnxruntime-node` |
| GHSA-238p-pmpm-9mq7 | `katex` 0.16.47 (prod, sólo build sobre contenido propio + CSS) | low | requiere contaminación de prototipo previa | upgrade a ≥0.18.2 es un minor de 0.x: va en su propio PR con revisión visual de las fórmulas |
| GHSA-82fw-gwwq-j7x9 | `vitest`/`@vitest/mocker` 4.1.9 (dev) | moderate | lectura de archivos vía mock redirigido en el runner local | 4.1.11 existe y cabe en el rango, pero `npm install` falla con un error interno de npm (`Cannot read properties of null (reading 'edgesOut')`, 2 intentos); `@vitest/coverage-v8` fija `vitest` exacto. Pendiente |
| GHSA-vfj7-8cjw-p6xm | `braces` 3.0.3 (dev, vía `micromatch`) | high | DoS con patrones anidados en herramientas de desarrollo | **sin versión parcheada** publicada |

Evidencia del audit antes/después, delta del lockfile y fichas oficiales:
`Anteproyecto/Prompts/lote_NOCTURNO_WEB_Y_G7_2026-10-12/` (fuera de este repo).

## Triage 2026-09-02 (histórico): sin avisos abiertos

Entonces el audit completo era 0/0/0/0/0 y no había filas de triage.

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
