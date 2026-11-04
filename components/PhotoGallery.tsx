"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, X } from "lucide-react";

const AUTOPLAY_MS = 3500;
const SWIPE_PX = 40;

// Galeria da ficha do item em formato de slides: a foto desliza para os lados
// com as setas, o teclado (← →), o gesto de arrastar no celular ou o play
// (passa sozinha). Clicar na foto abre em tela cheia, também com slides.
export default function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const count = photos.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Passa sozinho só quando o usuário aperta play; pausa ao abrir a tela cheia.
  useEffect(() => {
    if (!playing || fullscreen || count < 2) return;
    const timer = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, fullscreen, count, go]);

  // Teclado na tela cheia (Esc fecha) e trava a rolagem da página por baixo.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [fullscreen, go]);

  // Mantém a miniatura da foto atual à vista.
  useEffect(() => {
    const el = thumbsRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (count === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-outline-variant bg-white">
        <span className="material-symbols-outlined text-[56px] text-outline-variant" aria-hidden>
          image
        </span>
      </div>
    );
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > SWIPE_PX) go(delta < 0 ? 1 : -1);
  };

  const arrow =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70";

  return (
    <div className="space-y-3">
      <div
        className="group relative overflow-hidden rounded-xl border border-outline-variant bg-white"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="group"
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${alt}`}
      >
        <div
          className="flex aspect-square transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label={`Ampliar foto ${i + 1} de ${count}`}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              className="flex h-full w-full shrink-0 cursor-zoom-in items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo */}
              <img src={url} alt={`${alt} — foto ${i + 1}`} className="h-full w-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className={`${arrow} left-2`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className={`${arrow} right-2`}>
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pausar a apresentação" : "Passar as fotos automaticamente"}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label="Abrir em tela cheia"
          className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>

      {count > 1 && (
        <ul ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <li key={url} className="w-16 shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1} de ${count}`}
                aria-current={i === index}
                className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white transition-all ${
                  i === index ? "border-secondary ring-2 ring-secondary/40" : "border-outline-variant opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo */}
                <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${alt}`}
          onClick={() => setFullscreen(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Próxima foto"
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo */}
          <img
            src={photos[index]}
            alt={`${alt} — foto ${index + 1}`}
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white">
            {index + 1} / {count}
          </span>
        </div>
      )}
    </div>
  );
}
