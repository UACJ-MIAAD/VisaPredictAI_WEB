# Guion de la Cumbre · ruta /guion/

Revisión vigente: MINI v14. Rediseña únicamente la lámina 19 («Resultados y próximos pasos»): cifras principales a la izquierda y secuencia de trabajo futuro a la derecha, con alineación izquierda. Conserva las 21 notas habladas y las otras 20 láminas. Fuentes, PDF vectorial y PPTX en `Presentaciones/2026-11-16_B3_MINI_v14/`; el PDF se compone desde las fuentes vectoriales, sin rasterizar páginas. La imagen web 19 deriva de ese PDF. La descripción v13 siguiente conserva el antecedente de la fila restaurada.

Página de lectura y ensayo, sin añadirla al menú público. Usa el layout raíz y las fuentes/colores existentes; `robots` marca noindex/nofollow, lo que no constituye control de acceso. No incorpora servicios, dependencias ni tracking nuevos.

Contenido vigente: `app/guion/guion-data.json`, sincronizado con `Presentaciones/2026-11-15_B3_MINI_v13/notas.json`. V13 restaura la fila de personas original (versión completa v37, lámina8) en la lámina5 de la mini, con Ana en azul y la prioridad posterior al corte. Sustituye la explicación de los dos relojes; conserva21láminas, las dos tablas de4, visita de3, objetivos, arquitectura, MLOps y resultados. Sólo cambia la imagen05, su título, guion y fuente; las otras20láminas y notas del PPTX son exactas a v12r1. Generación de esta revisión en `preparar.py`/`generar.py`/`render_fila.cjs`; validación en `validar.py`. Los párrafos y `liveVisit.paragraphs` se dicen en voz alta; `cue` y `sourceNote` no. No usar generadores anteriores para sobrescribir esta revisión.

Vista de práctica: escritorio desde900px con dos paneles del mismo ancho, presentación grande a izquierda y guion con scroll independiente a derecha. Controles debajo: navegación, selector21láminas, letra22–42px, cronómetro y fullscreen. Móvil apilado y controles inferiores persistentes. Sin revelados ni avance automático. Guarda sólo tamaño y lámina elegida en localStorage. Presupuesto v12r1:828s contenido +60transiciones +12margen =15min;1,764palabras, incluida visita al boletín. Lámina3:102s (72explicación +30visita); lámina4:105s; portal18:30s. No descontar otra vez la visita del portal. Son tiempos previstos; ensayo humano pendiente.

Pruebas: build estático Next.js, TypeScript, lint focal y `tests/e2e/guion.spec.ts` (21 láminas/imágenes, teclado/enlace, límites de letra, timer, fallo de pantalla completa y móvil/axe en claro/oscuro). Los tests bloquean toda conexión externa.

Vista local del export ya compilado: desde este worktree, `node tests/e2e/static-server.mjs --port 4627`, y abrir `http://127.0.0.1:4627/guion/`. Detener el servidor propio al acabar.

Para recompilar en este equipo sin reinstalar: si falta `node_modules`, puede enlazarse temporalmente el directorio existente `../VisaPredictAI_web/node_modules`; no se modifica ese entorno. Ejecutar Next directamente evita los scripts de descarga de datos: `node node_modules/next/dist/bin/next build`, y después `node scripts/build-csp.mjs`. Eliminar sólo el enlace temporal propio al terminar. No cambiar locks o dependencias.

La ruta se publica desde main mediante Netlify. Crear archivos o pasar pruebas locales no acredita un despliegue: comprobar el dominio y registrar el SHA integrado y la prueba de producción. Respetar las autorizaciones vigentes del workspace para push, merge y publicación.
