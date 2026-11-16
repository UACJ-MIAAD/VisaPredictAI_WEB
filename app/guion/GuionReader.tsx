"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./guion.module.css";

export interface GuionLink {
  label: string;
  href: string;
}

export interface GuionSlide {
  number: number;
  title: string;
  seconds: number;
  startSeconds: number;
  paragraphs: string[];
  cue: string;
  links: GuionLink[];
  image: string;
}

export interface GuionEvent {
  date: string;
  time: string;
  place: string;
}

export interface GuionData {
  title: string;
  version: string;
  plannedSeconds: number;
  event: GuionEvent;
  slides: GuionSlide[];
}

export interface GuionReaderProps {
  data: GuionData;
}

const MIN_FONT_SIZE = 22;
const MAX_FONT_SIZE = 42;
const DEFAULT_FONT_SIZE = 28;
const FONT_STEP = 2;

const STORAGE_FONT_KEY = "visapredictai_guion_font_px";
const STORAGE_SLIDE_KEY = "visapredictai_guion_slide_number";

function clampFontSize(value: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

function formatTimecode(rawSeconds: number): string {
  const total = Math.max(0, Math.floor(rawSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isInteractiveTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }
  return false;
}

export default function GuionReader({ data }: GuionReaderProps) {
  const totalSlides = data.slides.length;
  const mobileSelectId = useId();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>("");

  const shellRef = useRef<HTMLDivElement | null>(null);
  const asideNavRef = useRef<HTMLElement | null>(null);
  const readerAnchorRef = useRef<HTMLDivElement | null>(null);
  const scriptZoneRef = useRef<HTMLDivElement | null>(null);
  const baseElapsedRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const rawFont = window.localStorage.getItem(STORAGE_FONT_KEY);
      if (rawFont !== null) {
        const parsedFont = Number(rawFont);
        if (Number.isFinite(parsedFont)) {
          setFontSize(clampFontSize(parsedFont));
        }
      }
    } catch {
      // Almacenamiento local no disponible; se mantiene el valor por defecto.
    }

    try {
      const rawSlide = window.localStorage.getItem(STORAGE_SLIDE_KEY);
      if (rawSlide !== null) {
        const parsedSlideNumber = Number(rawSlide);
        if (Number.isInteger(parsedSlideNumber)) {
          const foundIndex = data.slides.findIndex(
            (slide) => slide.number === parsedSlideNumber
          );
          if (foundIndex >= 0) {
            setCurrentIndex(foundIndex);
          }
        }
      }
    } catch {
      // Almacenamiento local no disponible; se inicia en la primera lámina.
    }
  }, [data.slides]);

  const resetReadingScroll = useCallback(() => {
    if (scriptZoneRef.current) {
      scriptZoneRef.current.scrollTop = 0;
    }
    if (
      typeof document !== "undefined" &&
      document.fullscreenElement === shellRef.current &&
      shellRef.current
    ) {
      shellRef.current.scrollTop = 0;
      return;
    }
    if (readerAnchorRef.current && typeof window !== "undefined") {
      const rect = readerAnchorRef.current.getBoundingClientRect();
      if (rect.top < 0) {
        window.scrollTo({
          top: Math.max(0, window.scrollY + rect.top - 12),
          behavior: "auto",
        });
      }
    }
  }, []);

  const selectSlideByIndex = useCallback(
    (nextIndex: number) => {
      if (totalSlides === 0) {
        return;
      }
      const bounded = Math.min(totalSlides - 1, Math.max(0, nextIndex));
      const targetSlide = data.slides[bounded];
      if (!targetSlide) {
        return;
      }
      setCurrentIndex(bounded);
      setLiveStatus(
        `Lámina ${targetSlide.number} de ${totalSlides}: ${targetSlide.title}`
      );
      try {
        window.localStorage.setItem(
          STORAGE_SLIDE_KEY,
          String(targetSlide.number)
        );
      } catch {
        // Ignorar errores de escritura en almacenamiento local.
      }
      resetReadingScroll();
    },
    [data.slides, resetReadingScroll, totalSlides]
  );

  useEffect(() => {
    const navEl = asideNavRef.current;
    if (!navEl) {
      return;
    }
    const activeButton = navEl.querySelector<HTMLButtonElement>(
      `[data-slide-index="${currentIndex}"]`
    );
    if (!activeButton) {
      return;
    }
    const navTop = navEl.scrollTop;
    const navBottom = navTop + navEl.clientHeight;
    const itemTop = activeButton.offsetTop;
    const itemBottom = itemTop + activeButton.offsetHeight;

    if (itemTop < navTop) {
      navEl.scrollTop = Math.max(0, itemTop - 8);
    } else if (itemBottom > navBottom) {
      navEl.scrollTop = itemBottom - navEl.clientHeight + 8;
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (event.key === "Escape") {
        setFullscreenError(null);
        return;
      }

      if (isInteractiveTextTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        if (currentIndex > 0) {
          event.preventDefault();
          selectSlideByIndex(currentIndex - 1);
        }
      } else if (event.key === "ArrowRight") {
        if (currentIndex < totalSlides - 1) {
          event.preventDefault();
          selectSlideByIndex(currentIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, selectSlideByIndex, totalSlides]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const intervalId = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        const delta = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsedSeconds(baseElapsedRef.current + delta);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        setFullscreenError(null);
      }
    };

    const handleFullscreenError = () => {
      const msg =
        "No se pudo activar la pantalla completa en este navegador. La lectura continúa disponible.";
      setFullscreenError(msg);
      setLiveStatus(msg);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("fullscreenerror", handleFullscreenError);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
    };
  }, []);

  const adjustFontSize = (delta: number) => {
    const nextSize = clampFontSize(fontSize + delta);
    if (nextSize === fontSize) {
      return;
    }
    setFontSize(nextSize);
    setLiveStatus(`Tamaño de lectura ajustado a ${nextSize} píxeles.`);
    try {
      window.localStorage.setItem(STORAGE_FONT_KEY, String(nextSize));
    } catch {
      // Ignorar errores de escritura en almacenamiento local.
    }
  };

  const handleToggleTimer = () => {
    if (isRunning) {
      const total =
        startedAtRef.current !== null
          ? baseElapsedRef.current +
            Math.floor((Date.now() - startedAtRef.current) / 1000)
          : elapsedSeconds;
      baseElapsedRef.current = total;
      startedAtRef.current = null;
      setElapsedSeconds(total);
      setIsRunning(false);
      setLiveStatus(`Cronómetro de ensayo en pausa en ${formatTimecode(total)}.`);
    } else {
      const resuming = elapsedSeconds > 0;
      startedAtRef.current = Date.now();
      setIsRunning(true);
      setLiveStatus(
        resuming
          ? "Cronómetro de ensayo reanudado."
          : "Cronómetro de ensayo iniciado."
      );
    }
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    baseElapsedRef.current = 0;
    startedAtRef.current = null;
    setElapsedSeconds(0);
    setLiveStatus("Cronómetro de ensayo reiniciado.");
  };

  const handleToggleFullscreen = async () => {
    setFullscreenError(null);
    if (typeof document === "undefined") {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setLiveStatus("Saliste de pantalla completa.");
      } else {
        const target = shellRef.current ?? document.documentElement;
        if (!document.fullscreenEnabled || typeof target.requestFullscreen !== "function") {
          const unsupported =
            "La pantalla completa no está disponible en este dispositivo. Puedes leer con normalidad.";
          setFullscreenError(unsupported);
          setLiveStatus(unsupported);
          return;
        }
        await target.requestFullscreen();
        setLiveStatus("Pantalla completa activada. Pulsa Escape para salir.");
      }
    } catch {
      const message =
        "No fue posible cambiar a pantalla completa. Puedes continuar en esta vista.";
      setFullscreenError(message);
      setLiveStatus(message);
    }
  };

  const currentSlide = data.slides[currentIndex] ?? data.slides[0];
  if (!currentSlide) {
    return (
      <div className={styles.shell}>
        <div className={styles.emptyState}>
          <p>No hay láminas cargadas para mostrar.</p>
          <Link href="/" className={styles.backLink}>
            Volver a VisaPredictAI
          </Link>
        </div>
      </div>
    );
  }

  const isFirstSlide = currentIndex === 0;
  const isLastSlide = currentIndex === totalSlides - 1;
  const timerActionLabel = isRunning
    ? "Pausar"
    : elapsedSeconds > 0
      ? "Reanudar"
      : "Iniciar";

  const scriptStyle = {
    "--guion-font-size": `${fontSize}px`,
  } as CSSProperties;

  return (
    <div ref={shellRef} className={styles.shell}>
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      <header className={styles.topHeader}>
        <div className={styles.brandBlock}>
          <div className={styles.brandRow}>
            <Link href="/" className={styles.backLink}>
              VisaPredictAI
            </Link>
            <span className={styles.separator} aria-hidden="true">
              /
            </span>
            <span className={styles.sectionBadge}>Exposición académica</span>
          </div>
          <h1 className={styles.pageTitle}>{data.title}</h1>
          <p className={styles.eventMeta}>
            <span>{data.event.date}</span>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span>{data.event.time}</span>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span>{data.event.place}</span>
          </p>
        </div>

        <div className={styles.controlsCluster} role="group" aria-label="Herramientas de ensayo y lectura">
          <div className={styles.timerBox}>
            <div className={styles.timerFigures}>
              <span className={styles.timerLabel}>Ensayo</span>
              <span className={styles.timerMono}>
                {formatTimecode(elapsedSeconds)}
              </span>
              <span className={styles.timerTotal}>
                / {formatTimecode(data.plannedSeconds)} previsto
              </span>
            </div>
            <div className={styles.timerActions}>
              <button
                type="button"
                onClick={handleToggleTimer}
                className={styles.controlBtn}
                aria-label={`${timerActionLabel} cronómetro de ensayo`}
              >
                {timerActionLabel}
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                disabled={elapsedSeconds === 0 && !isRunning}
                className={styles.controlBtn}
                aria-label="Reiniciar cronómetro de ensayo"
              >
                Reiniciar
              </button>
            </div>
          </div>

          <div className={styles.readingTools}>
            <div className={styles.fontControls} role="group" aria-label="Tamaño de letra del guion">
              <button
                type="button"
                onClick={() => adjustFontSize(-FONT_STEP)}
                disabled={fontSize <= MIN_FONT_SIZE}
                className={styles.controlBtn}
                aria-label="Reducir tamaño de letra"
              >
                A−
              </button>
              <span className={styles.fontReadout} aria-hidden="true">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => adjustFontSize(FONT_STEP)}
                disabled={fontSize >= MAX_FONT_SIZE}
                className={styles.controlBtn}
                aria-label="Aumentar tamaño de letra"
              >
                A+
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-pressed={isFullscreen}
              className={styles.controlBtn}
            >
              {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            </button>
          </div>
        </div>
      </header>

      {fullscreenError ? (
        <div className={styles.noticeBanner}>
          <span>{fullscreenError}</span>
          <button
            type="button"
            onClick={() => setFullscreenError(null)}
            className={styles.dismissBtn}
            aria-label="Cerrar aviso de pantalla completa"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      <div className={styles.mobileNavBar}>
        <label htmlFor={mobileSelectId} className={styles.mobileSelectLabel}>
          Ir a lámina
        </label>
        <select
          id={mobileSelectId}
          value={currentIndex}
          onChange={(event) => selectSlideByIndex(Number(event.target.value))}
          className={styles.mobileSelect}
        >
          {data.slides.map((slide, idx) => (
            <option key={slide.number} value={idx}>
              {slide.number}. {slide.title} ({formatTimecode(slide.seconds)})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.workspace}>
        <aside
          ref={asideNavRef}
          className={styles.sidebar}
          aria-label="Índice de láminas"
        >
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Índice ({totalSlides})</span>
            <span className={styles.sidebarTotal}>
              {formatTimecode(data.plannedSeconds)} previsto
            </span>
          </div>
          <ol className={styles.slideList}>
            {data.slides.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <li key={slide.number} className={styles.slideListItem}>
                  <button
                    type="button"
                    data-slide-index={idx}
                    onClick={() => selectSlideByIndex(idx)}
                    aria-current={isActive ? "step" : undefined}
                    className={`${styles.slideNavBtn} ${
                      isActive ? styles.slideNavBtnActive : ""
                    }`}
                  >
                    <span className={styles.slideNavNum}>
                      {String(slide.number).padStart(2, "0")}
                    </span>
                    <span className={styles.slideNavTitle}>{slide.title}</span>
                    <span className={styles.slideNavTime}>
                      {formatTimecode(slide.seconds)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <main ref={readerAnchorRef} className={styles.readerMain}>
          <div className={styles.slideDeckBar}>
            <div className={styles.slideMetaPrimary}>
              <p className={styles.slideCounter}>
                Lámina {currentSlide.number} / {totalSlides}
              </p>
              <div className={styles.slideTimings}>
                <span>
                  Inicio previsto:{" "}
                  <strong className={styles.monoStrong}>
                    {formatTimecode(currentSlide.startSeconds)}
                  </strong>
                </span>
                <span className={styles.dot} aria-hidden="true">
                  ·
                </span>
                <span>
                  Duración prevista:{" "}
                  <strong className={styles.monoStrong}>
                    {formatTimecode(currentSlide.seconds)}
                  </strong>
                </span>
              </div>
            </div>

            <div className={styles.stepButtons}>
              <button
                type="button"
                onClick={() => selectSlideByIndex(currentIndex - 1)}
                disabled={isFirstSlide}
                className={styles.navStepBtn}
                aria-label="Lámina anterior"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => selectSlideByIndex(currentIndex + 1)}
                disabled={isLastSlide}
                className={styles.navStepBtn}
                aria-label="Lámina siguiente"
              >
                Siguiente
              </button>
            </div>
          </div>

          <div ref={scriptZoneRef} className={styles.scriptZone} style={scriptStyle}>
            <div className={styles.slideOverview}>
              <div className={styles.slideHeadingBlock}>
                <h2 className={styles.slideTitle}>{currentSlide.title}</h2>
                {currentSlide.cue.trim().length > 0 ? (
                  <p className={styles.cueBox}>
                    <span className={styles.cueLabel}>Indicación: </span>
                    {currentSlide.cue}
                  </p>
                ) : null}
                {currentSlide.links.length > 0 ? (
                  <ul className={styles.linksList} aria-label="Referencias de esta lámina">
                    {currentSlide.links.map((link) => {
                      const external = isExternalHref(link.href);
                      return (
                        <li key={`${link.href}-${link.label}`}>
                          <a
                            href={link.href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            className={styles.resourceLink}
                          >
                            {link.label}
                            {external ? " (abre en pestaña nueva)" : ""}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <figure className={styles.thumbnailFrame}>
                <Image
                  src={currentSlide.image}
                  alt={`Miniatura de la lámina ${currentSlide.number} de ${totalSlides}: ${currentSlide.title}`}
                  width={1600}
                  height={900}
                  unoptimized
                  priority
                  className={styles.thumbnailImg}
                />
              </figure>
            </div>

            <div className={styles.spokenBody}>
              {currentSlide.paragraphs.map((paragraph, pIndex) => (
                <p key={`${currentSlide.number}-p-${pIndex}`} className={styles.spokenParagraph}>
                  {paragraph}
                </p>
              ))}
            </div>

            <footer className={styles.readerFooter}>
              <button
                type="button"
                onClick={() => selectSlideByIndex(currentIndex - 1)}
                disabled={isFirstSlide}
                className={styles.navStepBtn}
              >
                Anterior
              </button>
              <span className={styles.footerIndicator}>
                Lámina {currentSlide.number} / {totalSlides}
              </span>
              <button
                type="button"
                onClick={() => selectSlideByIndex(currentIndex + 1)}
                disabled={isLastSlide}
                className={styles.navStepBtn}
              >
                Siguiente
              </button>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

