<p align="center">
  <img src="https://img.shields.io/badge/UACJ-003CA6?style=for-the-badge" alt="UACJ"/>
  <img src="https://img.shields.io/badge/MIAAD-FFD600?style=for-the-badge&logoColor=003CA6&labelColor=003CA6" alt="MIAAD"/>
  <img src="https://img.shields.io/badge/Status-En%20Desarrollo-FFD600?style=for-the-badge&labelColor=555559" alt="Status"/>
  <img src="https://img.shields.io/badge/Licencia-MIT-003CA6?style=for-the-badge&labelColor=555559" alt="Licencia"/>
</p>

# 🌐 VisaPredict AI — Web

**Sitio web oficial del proyecto VisaPredict AI**, desarrollado como parte del programa de Maestría en Inteligencia Artificial y Analítica de Datos (MIAAD) de la Universidad Autónoma de Ciudad Juárez (UACJ).

> Este repositorio contiene exclusivamente el código fuente de la **página web del proyecto**. Para el código de los modelos de Machine Learning y análisis de datos, consulta el repositorio principal.

---

## 📋 Descripción

VisaPredict AI es un **sistema predictivo aplicado** para las fechas de prioridad del *U.S. Visa Bulletin*, organizado como **panel multiserie** indexado por país o área de cargabilidad, categoría migratoria y tipo de tabla. Genera pronósticos mensuales a horizontes de 1, 3, 6 y 12 meses con **intervalos de predicción al 95 %**, instrumentado bajo la metodología **CRISP-DM** (Chapman et al. 2000). Esta página web sirve como la **interfaz pública descriptiva del proyecto**, proporcionando:

- Presentación general del proyecto y sus objetivos
- Resumen de los 4 capítulos del anteproyecto (Introducción, Marco teórico, Producto esperado y validación, Metodología CRISP-DM)
- **Secciones de ingeniería de datos** (`#datos`, `#mlops`, `#estructura`, `#modelo`): la construcción del panel, las prácticas MLOps, la plantilla cookiecutter del repo, y el **almacén estrella en DuckDB** con su **diagrama ER** y el catálogo de las 11 tablas
- Glosario operativo (42 términos) y bibliografía IEEE (64 referencias)
- Documentación accesible para usuarios finales con disclaimer académico
- Información sobre el equipo de investigación y la rúbrica del programa MIAAD

> **Sincronizado con la versión v5.13** del `AnteproyectoVisaPredictAI.tex` entregada al Dr. Vicente García Jiménez el 13 de mayo de 2026.

## 🏗️ Estructura del Proyecto

```
VisaPredictAI_WEB/
├── CLAUDE.md                       Convenciones, don'ts y mapeo a LaTeX
├── README.md                       Este archivo
├── index.html                      SPA principal (todo el sitio, ~2990 líneas, 16 secciones)
├── schema_er.svg                   Diagrama ER del almacén de datos (sección #modelo)
├── index4.html                     Versión legacy (anterior a v3, conservada como referencia)
├── LogoVisaPredictAI.png           Logo principal (header, footer, favicon)
├── LogoVisaPredictAI_vfull.png     Logo extendido alta resolución
├── JARSPROFILE.jpg                 Foto del tesista
├── DrVicente.png                   Foto del director
├── logouacj.png                    Logo institucional UACJ
└── .firebaserc                     Config Firebase Hosting (alternativo)
```

> *Sitio estático single-page sin build step y sin dependencias npm.*

## 🚀 Tecnologías

| Componente | Tecnología |
|:-----------|:-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS (sin framework) |
| Tipografías | Google Fonts: Playfair Display, DM Sans, Space Mono |
| Hosting primario | Netlify (auto-deploy desde `main`) |
| Hosting alternativo | Firebase Hosting (proyecto `visapredict-ai`) |
| Diseño | Responsive / Mobile-first |

## 🎨 Paleta de Colores

Basada en el **Manual Básico de Identidad Gráfica Institucional** de la UACJ.

| Color | Pantone | HEX | Uso |
|:------|:--------|:----|:----|
| 🔵 Azul | 293 C | `#003CA6` | Color primario institucional |
| 🟡 Amarillo | Yellow 012 C | `#FFD600` | Color secundario (web e imprenta) |
| ⚫ Gris | Cool Gray 11 C | `#555559` | Textos y elementos de apoyo |
| ⬛ Negro | Process Black | `#231F20` | Textos y arreglos negativos |

## 🔗 Repositorios Relacionados

| Repositorio | Descripción |
|:------------|:------------|
| [VisaPredictAI_WEB](https://github.com/UACJ-MIAAD/VisaPredictAI_WEB) | 📍 Este repositorio — Página web del proyecto |
| [VisaPredictAI](https://github.com/UACJ-MIAAD/VisaPredictAI) | Scraping, panel multiserie y **almacén estrella DuckDB** (datos + base de datos) |

## 👥 Equipo

| Rol | Nombre | Institución |
|:----|:-------|:------------|
| Estudiante | Javier Rebull | UACJ — MIAAD |
| Director de Tesis | Dr. Vicente García Jiménez | UACJ — Depto. de Ingeniería Eléctrica y Computación |

## 🏛️ Contexto Académico

Este proyecto se desarrolla en el marco del programa de **Maestría en Inteligencia Artificial y Analítica de Datos (MIAAD)** de la UACJ, dentro de las líneas de investigación:

- Analítica Descriptiva y Predictiva
- Analítica Prescriptiva y Soporte a la Decisión

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

<p align="center">
  <strong>Universidad Autónoma de Ciudad Juárez</strong><br/>
  Maestría en Inteligencia Artificial y Analítica de Datos<br/>
  Sitio v5.13 · Mayo 2026
</p>
