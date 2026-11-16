# Guion de la Cumbre · ruta /guion/

Página de lectura y ensayo, sin añadirla al menú público. Usa el layout raíz y las fuentes/colores existentes; `robots` marca noindex/nofollow, lo que no constituye control de acceso. No incorpora servicios, dependencias ni tracking nuevos.

Contenido vigente: `app/guion/guion-data.json`, sincronizado con `Presentaciones/2026-11-15_B3_MINI_v11r2/notas.json` mediante el `sincronizar_web.py` de esa revisión en el workspace documental. No usar el sincronizador anterior de v11: sobrescribiría las correcciones de las láminas 1 y 3. Los párrafos son el texto hablado; `cue` contiene indicaciones que no se pronuncian. En el PPTX, la nota 3 añade al final una precisión identificada como fuente, con fecha, cifra exacta, enlace y alcance de la población. Las miniaturas siguen siendo las de v11: sólo cambiaron notas, las láminas visibles son idénticas.

Controles: índice lateral o selector móvil, Anterior/Siguiente y flechas, tamaño 22–42 px, pantalla completa opcional y cronómetro manual. Guarda sólo tamaño y lámina elegida en localStorage; funciona si el almacenamiento falla. La visita opcional al boletín en 3 consume parte de los 60 s reservados a demo18. La 3 dispone de 75 s; el presupuesto total mantiene 15 minutos: 820 s de contenido, 60 de transiciones y 20 de margen. Los tiempos son previstos; no representan un ensayo humano realizado.

Pruebas: build estático Next.js, TypeScript, lint focal y `tests/e2e/guion.spec.ts` (21 láminas/imágenes, teclado/enlace, límites de letra, timer, fallo de pantalla completa y móvil/axe en claro/oscuro). Los tests bloquean toda conexión externa.

Vista local del export ya compilado: desde este worktree, `node tests/e2e/static-server.mjs --port 4627`, y abrir `http://127.0.0.1:4627/guion/`. Detener el servidor propio al acabar.

Para recompilar en este equipo sin reinstalar: si falta `node_modules`, puede enlazarse temporalmente el directorio existente `../VisaPredictAI_web/node_modules`; no se modifica ese entorno. Ejecutar Next directamente evita los scripts de descarga de datos: `node node_modules/next/dist/bin/next build`, y después `node scripts/build-csp.mjs`. Eliminar sólo el enlace temporal propio al terminar. No cambiar locks o dependencias.

Trabajo local en rama `presentacion-guion-cumbre-2026-11-15`, base `572a32f07479cef50bf79f041265413eac34fd01`. No está publicado por crear la ruta ni por superar las pruebas; push/publicación necesitan autorización separada conforme al AGENTS del workspace.
