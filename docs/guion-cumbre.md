# Guion de la Cumbre · ruta /guion/

Página de lectura y ensayo, sin añadirla al menú público. Usa el layout raíz y las fuentes/colores existentes; `robots` marca noindex/nofollow, lo que no constituye control de acceso. No incorpora servicios, dependencias ni tracking nuevos.

Contenido vigente: `app/guion/guion-data.json`, sincronizado con `Presentaciones/2026-11-15_B3_MINI_v12/notas.json` en el workspace documental. La revisión completa explica cada término antes de usarlo; conserva literalmente la apertura, agenda y explicación3 aprobadas. Fuentes editables y generador de notas/PPTX: `cambios_guion.json` y `generar.py` en v12. No usar sincronizadores v11: sobrescribirían la revisión. Los párrafos son el texto hablado; `cue` contiene indicaciones que no se pronuncian. En el PPTX, la nota3 añade fuente, fecha, cifra exacta, enlace y alcance de la población. Las imágenes siguen siendo las de v11: las láminas visibles son idénticas.

Vista de práctica: escritorio desde 900px con dos paneles del mismo ancho, presentación grande a la izquierda y guion con desplazamiento independiente a la derecha. Controles siempre debajo: Anterior/Siguiente, selector de21 láminas, letra22–42px, cronómetro manual y pantalla completa opcional. Móvil: lámina y texto apilados, controles inferiores persistentes. No hay revelados ni avance automático. Guarda sólo tamaño y lámina elegida en localStorage; funciona si el almacenamiento falla. La visita opcional al boletín en3 consume parte de los60s de demo18. Presupuesto:820s contenido +60 transiciones +20 margen =15min, con1,627 palabras. Los tiempos son previstos; ensayo humano pendiente.

Pruebas: build estático Next.js, TypeScript, lint focal y `tests/e2e/guion.spec.ts` (21 láminas/imágenes, teclado/enlace, límites de letra, timer, fallo de pantalla completa y móvil/axe en claro/oscuro). Los tests bloquean toda conexión externa.

Vista local del export ya compilado: desde este worktree, `node tests/e2e/static-server.mjs --port 4627`, y abrir `http://127.0.0.1:4627/guion/`. Detener el servidor propio al acabar.

Para recompilar en este equipo sin reinstalar: si falta `node_modules`, puede enlazarse temporalmente el directorio existente `../VisaPredictAI_web/node_modules`; no se modifica ese entorno. Ejecutar Next directamente evita los scripts de descarga de datos: `node node_modules/next/dist/bin/next build`, y después `node scripts/build-csp.mjs`. Eliminar sólo el enlace temporal propio al terminar. No cambiar locks o dependencias.

Trabajo local en rama `presentacion-guion-cumbre-2026-11-15`, base `572a32f07479cef50bf79f041265413eac34fd01`. No está publicado por crear la ruta ni por superar las pruebas; push/publicación necesitan autorización separada conforme al AGENTS del workspace.
