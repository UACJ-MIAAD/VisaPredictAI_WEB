# CLAUDE.md — VisaPredict AI · Sitio web del proyecto

> Lee este archivo al inicio de cada sesión. Resume convenciones, rutas y *don'ts* críticos del repositorio web. Idioma: narrativa en español, términos técnicos en inglés.

---

## a) Repository Overview

- **Repositorio:** `UACJ-MIAAD/VisaPredictAI_WEB` (GitHub) · publicado en **Netlify** desde la rama `main` (auto-deploy).
- **Dominio:** `https://visapredictai.com/`
- **Naturaleza académica:** este sitio es **proyecto personal del autor** con fines descriptivos del trabajo de investigación. **NO** es el entregable académico evaluado de la tesis MIAAD. El demostrador oficial se entrega desde el repositorio público con DOI académico (Apéndice A.2 del anteproyecto). Cualquier cifra cuantitativa publicada aquí es ilustrativa, **no constituye asesoría legal** y debe acompañarse del disclaimer correspondiente.
- **Origen:** repositorio derivado del workspace académico en `~/Documents/Anteproyecto/` (que contiene el `.tex` con DOI, el scraping y este sitio). El sitio se sincroniza manualmente cuando hay cambios sustantivos en el anteproyecto.
- **Stack:** sitio estático single-page (HTML + CSS + JS inline) sin framework. Sin build step. Sin dependencias npm.

## b) Key People

| Rol | Nombre | Notas |
|---|---|---|
| Tesista / autor del sitio | Javier Augusto Rebull Saucedo | Matrícula 263483 · `al263483@alumnos.uacj.mx` · `jrebull` (GitHub) |
| Director de tesis | Dr. Vicente García Jiménez | `vicente.jimenez@uacj.mx` |

## c) Repository Structure

```
VisaPredictAI_WEB/                         ← raíz del repositorio Git
├── CLAUDE.md                              ★ este archivo
├── README.md                              instrucciones rápidas de despliegue
├── index.html                             ★ SPA principal (todo el sitio)
├── index4.html                            versión legacy (anterior a v3)
├── .firebaserc                            config Firebase Hosting (proyecto: visapredict-ai)
├── .gitignore                             ignora .DS_Store, *.bak, node_modules, etc.
├── LogoVisaPredictAI.png                  logo principal (header, footer, favicon)
├── LogoVisaPredictAI_vfull.png            logo extendido alta resolución
├── JARSPROFILE.jpg                        foto del tesista (autores)
├── JaviRebull.png                         foto alternativa
├── DrVicente.png                          foto del director (autores)
└── logouacj.png                           logo institucional UACJ
```

**Archivos críticos** (no mover, no renombrar): `index.html`, `LogoVisaPredictAI.png`, `JARSPROFILE.jpg`, `DrVicente.png`.

## d) Tech Stack & Tooling

- **Frontend:** HTML5 + CSS3 + Vanilla JS (sin framework, sin build).
- **Tipografías:** Google Fonts — *Playfair Display* (display), *DM Sans* (body), *Space Mono* (mono).
- **Iconografía:** SVG inline (no dependencias externas).
- **Deploy primario:** Netlify (auto-deploy desde `main`).
- **Deploy alternativo:** Firebase Hosting (proyecto `visapredict-ai`, config en `.firebaserc`).

## e) Site Conventions

- **Paleta institucional UACJ** (definida como CSS variables en `:root`):
  - `--azul: #003CA6` (primario)
  - `--amarillo: #FFD600` (acento)
  - `--gris: #555559` (secundario)
  - `--negro: #231F20` (texto)
  - Variantes derivadas: `--azul-deep`, `--amarillo-d`, `--azul-soft`, etc.
- **Idioma:** español académico. Términos técnicos en inglés con traducción la primera vez (formato `Nombre completo (English term, ACR)`).
- **Acrónimos:** definir en su primera aparición; reutilizar la sigla después.
- **Decimales con punto**, no coma.
- **Disclaimer banner** en la parte superior del `<body>`: el sitio es proyecto personal del autor, no entregable evaluado. Reproducir en el footer también.
- **Sticky nav** con sombra al scroll · 11 secciones ancladas (`#inicio`, `#resumen`, `#capi`, `#capii`, `#capiii`, `#tablas`, `#reproducibilidad`, `#glosario`, `#referencias`, `#autores`, `#contacto`).
- **Sin librerías externas en runtime** (excepto Google Fonts vía CDN). No introducir Chart.js, jQuery, Bootstrap, etc., sin documentar la decisión aquí.
- **Reveal animations** vía IntersectionObserver puro · clase `.reveal` con variantes `.reveal--d1`, `.reveal--d2`, etc.
- **Glosario y referencias** se filtran client-side (`<input>` y `<button class="ref-tab">`) sin estado en URL.

## f) Workflow

- **Edición:** modificar `index.html` directamente; no fragmentar en archivos separados sin justificación (la simplicidad del SPA lo justifica).
- **Validación local:**
  ```bash
  cd /Users/haowei/Documents/Anteproyecto/VisaPredictAI_web
  python3 -m http.server 8765
  # navegar a http://localhost:8765/
  ```
- **Validación de tags HTML:**
  ```bash
  python3 -c "from html.parser import HTMLParser; ..."  # ver Quick Commands
  ```
- **Sincronización con el anteproyecto:** cuando el `.tex` cambia (nuevos fixes de auditoría, ajustes de título, hipótesis, glosario o bibliografía), **revisar y actualizar** las secciones correspondientes del `index.html` para mantener coherencia. Especialmente:
  - Convención F1–F4
  - Estado de "ARIMA-LSTM" (debe ser uno de los candidatos del benchmark, no "modelo central")
  - Sentimiento como extensión deseable (no entregable mínimo)
  - Cobertura multi-país (no México-only)
  - Niveles de éxito (Tabla 5)
  - Cantidad de modelos comparados (8 actualmente)
  - Disclaimer Apéndice A.4 (proyecto personal vs. entregable evaluado)
- **Commits:** mensajes en inglés (convención del repo), branch `main`. No usar `git push --force` salvo emergencia documentada.

## g) Critical Don'ts ⚠️

1. **⚠️ NO presentar este sitio como el entregable académico evaluado.** El disclaimer del banner superior y del footer es de cumplimiento obligatorio. El demostrador oficial se entrega desde el repositorio académico con DOI (Apéndice A.2 del .tex).
2. **⚠️ NO introducir cifras cuantitativas** que sugieran resultados experimentales no obtenidos (ej. "94.7 % precisión") &mdash; la versión legacy del sitio (`index4.html`) lo hacía y fue corregido. Usar siempre lenguaje de objetivos/criterios prospectivos.
3. **⚠️ NO hablar de ARIMA-LSTM como "modelo central"** o "propuesta de la tesis"; es uno de los 8 candidatos del benchmark, sin privilegio a priori.
4. **⚠️ NO presentar el sentimiento** como parte del entregable mínimo; es **extensión deseable** condicional al despliegue.
5. **⚠️ NO presentar la cobertura como "México-only"**; el alcance es multi-país (MX · IN · CN · PH · All Charg.).
6. **⚠️ NO mover, renombrar ni borrar** los assets de imagen (`LogoVisaPredictAI.png`, `JARSPROFILE.jpg`, `DrVicente.png`, `logouacj.png`).
7. **⚠️ NO commitear** archivos `*.bak`, `.DS_Store`, ni cualquier archivo de uso local; ya están en `.gitignore`.
8. **⚠️ NO commitear** archivos con secrets (.env, credenciales API). Si en el futuro se añade backend, usar Netlify env variables.
9. **⚠️ NO introducir frameworks pesados** (React, Vue, etc.) sin discusión previa; la simplicidad del SPA estático es deliberada.
10. **⚠️ NO modificar `LogoVisaPredictAI.png`** ni la paleta UACJ sin coordinar con el tesista.

## h) Quick Commands

```bash
# Servir el sitio localmente para validación
cd /Users/haowei/Documents/Anteproyecto/VisaPredictAI_web && python3 -m http.server 8765

# Validar balance de tags HTML
python3 -c "
from html.parser import HTMLParser
class V(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.void = {'meta','link','img','br','hr','input','svg','line','rect','text','path','circle','use','g','defs','marker','stop','linearGradient','polyline','source','area'}
    def handle_starttag(self, tag, attrs):
        if tag.lower() not in self.void:
            self.stack.append((tag, self.getpos()))
    def handle_endtag(self, tag):
        if tag.lower() in self.void: return
        if not self.stack:
            self.errors.append(f'Unmatched </{tag}> at {self.getpos()}'); return
        last, pos = self.stack.pop()
        if last.lower() != tag.lower():
            self.errors.append(f'Mismatched: opened <{last}> at {pos}, closing </{tag}> at {self.getpos()}')
v = V()
with open('index.html') as f: v.feed(f.read())
print('OK' if not v.errors and not v.stack else f'{len(v.errors)} errors')
"

# Conteo de secciones, referencias, términos del glosario
grep -c '<section' index.html       # debe ser 11+ (no incluye banner)
grep -c 'class=\"ref-item\"' index.html  # debe ser 81 (1:1 con la bibliografía del .tex)
grep -c 'class=\"gloss-item\"' index.html  # debe ser 51

# Deploy a Firebase (alternativo)
firebase deploy --only hosting

# Push a Netlify (auto-deploy desde main)
git add . && git commit -m "..." && git push origin main
```

## i) Site Sections Map → LaTeX Anteproyecto

| Sección del sitio | Sección del .tex | Notas |
|---|---|---|
| Hero | Portada + título oficial v3.3 | Subtítulo refleja "panel multiserie + benchmarking + formulación mixta" |
| Resumen | `Resumen` | 4 cards: problema, unidad de análisis, estrategia, entregable mínimo |
| Cap I | Capítulo I (1.1–1.5) | 5 subsecciones inline; H1/H2/H3 falsificables con H₀ explícitas |
| Cap II | Capítulo II (Marco Teórico A–L) | 12 cards de marco teórico + callout de marco tecnológico |
| Cap III | Capítulo III (3.1–3.3) | Diagrama SVG de arquitectura mixta, niveles de éxito (Mín/Sat/Ideal) |
| Tablas | Tablas 1, 2, 3 + figura matriz | Tabla 1 cobertura, Tabla 2 exclusión, Tabla 3 baselines (8), matriz país×categoría×tabla |
| Reproducibilidad | Apéndice A.3 | 7 cards R1–R7 + estructura del repositorio |
| Glosario | Glosario `.tex` | 51 términos con buscador en vivo |
| Referencias | Bibliografía IEEE | 81 entradas con tabs por bloque temático |
| Autores | Apéndice "Acerca del autor y del asesor" | Foto + bio + email del tesista y del director |
| Contacto | — | CTA al email del tesista |
| Footer | Pie + disclaimer A.4 | Disclaimer académico persistente |

## j) Open TODO / future work

- [ ] Cuando esté disponible, añadir enlace al **DOI académico** del repositorio del demostrador oficial (Apéndice A.2 del .tex).
- [ ] Cuando se ejecute la **extensión deseable** de sentimiento, añadir sección dedicada con resultados de la ablación residualizada (sólo si los datos lo respaldan).
- [ ] Considerar **Open Graph / Twitter Card** meta tags para mejorar la presentación en redes sociales si el sitio se difunde.
- [ ] Considerar añadir **`sitemap.xml`** y **`robots.txt`** si Netlify/SEO lo requiere.
- [ ] Si el sitio crece más allá del SPA, considerar migración a **11ty** o **Astro** preservando el HTML actual.
- [ ] Cuando se cierre el cronograma de Capítulo IV, **reflejar el cronograma** en el sitio si es de utilidad para colaboradores.

## k) Decisions taken (registered to avoid revisiting)

- **Sin framework JS.** El sitio es estático puro porque su contenido es semi-permanente y no requiere interactividad pesada. Decisión revisable solo si se añade un demostrador interactivo no trivial.
- **Single-page (SPA con anclas).** Mejor que multi-page para un sitio académico de este tamaño (≈140 KB) con navegación lineal.
- **Disclaimer banner permanente.** Reproducción literal de la separación documentada en el Apéndice A.4 del `.tex` (proyecto personal vs. entregable académico).
- **Imágenes del Latex copiadas localmente.** No referenciar imágenes desde el `Docus/Latex/Figures/` original; el repo web es autocontenido.
- **`index4.html` se conserva** como referencia histórica del diseño previo. No eliminar sin coordinar.

---

*Última actualización: 2026-04-26 (rewrite v3.3 alineado con anteproyecto post Fixes 1–21: benchmarking puro, formulación mixta C/U/F, cobertura multi-país, sentimiento como extensión deseable, glosario 51 términos, bibliografía 81 refs, autores y reproducibilidad R1–R7).*
