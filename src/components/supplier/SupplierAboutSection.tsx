"use client";

import Image from "next/image";
import { ArrowUpRight, Award, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "@/components/supplier/supplier-about.css";

type SupplierAboutSectionProps = {
  supplierName: string;
  imageUrl: string | null;
  title?: string | null;
  subtitle?: string | null;
  /** HTML sanitized by the public profile's existing sanitizer. */
  sanitizedHtml: string;
  verified: boolean;
  className?: string;
};

type StoryPreview = { source: string; text: string | null; hasMore: boolean };

export function SupplierAboutSection({
  supplierName,
  imageUrl,
  title,
  subtitle,
  sanitizedHtml,
  verified,
  className = "",
}: SupplierAboutSectionProps) {
  const headingId = useId();
  const dialogId = useId();
  const dialogTitleId = useId();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoryPreview | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const richMeasureRef = useRef<HTMLDivElement>(null);
  const textMeasureRef = useRef<HTMLParagraphElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const storyBodyRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);
  const hasImage = Boolean(imageUrl && imageUrl !== failedImage);
  const effectiveTitle = title?.trim() || `Sobre ${supplierName}`;
  const currentPreview = preview?.source === sanitizedHtml ? preview : null;

  useEffect(() => {
    const container = previewRef.current;
    const richMeasure = richMeasureRef.current;
    const textMeasure = textMeasureRef.current;
    if (!container || !richMeasure || !textMeasure) return;

    let active = true;
    let frame = 0;
    const measure = () => {
      if (!active || !container.clientWidth) return;
      const maxHeight = parseFloat(getComputedStyle(textMeasure).lineHeight) * 6;
      let text: string | null = null;
      const hasMore = richMeasure.scrollHeight > maxHeight + 1;

      if (hasMore) {
        // Extract visible words without joining adjacent paragraphs/list items.
        // The original, sanitized HTML remains untouched for the full story.
        const document = new DOMParser().parseFromString(
          sanitizedHtml.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>|<br\b[^>]*>/gi, "$& "),
          "text/html",
        );
        const words = (document.body.textContent || "").trim().split(/\s+/).filter(Boolean);
        let low = 0;
        let high = words.length;
        while (low < high) {
          const count = Math.ceil((low + high) / 2);
          textMeasure.textContent = `${words.slice(0, count).join(" ")}…`;
          if (textMeasure.scrollHeight <= maxHeight + 1) low = count;
          else high = count - 1;
        }
        const excerpt = words.slice(0, low).join(" ");
        text = low < words.length ? `${excerpt.replace(/[.,;:!?…]+$/u, "")}…` : excerpt;
      }

      setPreview((current) =>
        current?.source === sanitizedHtml && current.text === text && current.hasMore === hasMore
          ? current
          : { source: sanitizedHtml, text, hasMore },
      );
    };
    const scheduleMeasure = () => {
      if (!active) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    observer.observe(richMeasure);
    scheduleMeasure();
    void document.fonts.ready.then(scheduleMeasure);
    return () => {
      active = false;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [sanitizedHtml]);

  const restorePage = useCallback(() => {
    if (previousOverflowRef.current === null) return;
    document.body.style.overflow = previousOverflowRef.current;
    previousOverflowRef.current = null;
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus({ preventScroll: true });
    }
    previousFocusRef.current = null;
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      dialog?.close();
      restorePage();
    };
  }, [restorePage]);

  const openStory = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    previousOverflowRef.current = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (storyBodyRef.current) storyBodyRef.current.scrollTop = 0;
    closeRef.current?.focus();
  };

  return (
    <section id="nosotros" aria-labelledby={headingId} className={`supplier-surface-page scroll-mt-20 bg-[var(--supplier-page-background)] py-14 sm:py-16 lg:py-20 ${className}`}>
      <div className={`mx-auto grid max-w-6xl items-center gap-8 px-5 sm:gap-10 md:px-8 lg:gap-14 ${hasImage ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}>
        {hasImage && imageUrl ? (
          <figure className="relative mx-auto aspect-[4/5] max-h-[550px] w-full max-w-[440px] overflow-hidden rounded-[1.75rem] bg-[var(--supplier-card-background)] lg:mx-0">
            <Image src={imageUrl} alt={`Imagen del negocio ${supplierName}`} fill unoptimized sizes="(min-width: 1024px) 440px, (min-width: 640px) 440px, calc(100vw - 40px)" className="object-cover object-center" onError={() => setFailedImage(imageUrl)} />
          </figure>
        ) : null}

        <div className={`min-w-0 ${hasImage ? "" : "mx-auto w-full max-w-3xl"}`}>
          <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--supplier-accent)]">
            <span aria-hidden="true" className="h-px w-8 bg-[var(--supplier-outline)]" />
            Nuestra historia
          </p>
          <h2 id={headingId} className="break-words font-[family-name:var(--font-varela-round)] text-3xl leading-tight tracking-[-0.025em] text-[var(--supplier-heading)] sm:text-4xl lg:text-[2.6rem]">
            {effectiveTitle}
          </h2>
          {subtitle?.trim() ? <p className="mt-3 break-words text-base font-medium leading-relaxed text-[var(--supplier-accent)] sm:text-lg">{subtitle.trim()}</p> : null}

          <div ref={previewRef} className="relative mt-5 min-w-0 text-base leading-7 text-[var(--supplier-muted)]">
            {/* Measurements are invisible to assistive technology and cannot receive focus. */}
            <div aria-hidden="true" inert className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
              <div ref={richMeasureRef} className="supplier-about-rich ql-editor" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              <p ref={textMeasureRef} className="m-0 break-words leading-7 [overflow-wrap:anywhere]" />
            </div>
            {currentPreview?.text !== null && currentPreview?.text !== undefined ? (
              <p className="break-words [overflow-wrap:anywhere]">{currentPreview.text}</p>
            ) : (
              <div className={`supplier-about-rich ql-editor ${currentPreview ? "" : "max-h-[10.5rem] overflow-hidden"}`} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            )}
          </div>

          {currentPreview?.hasMore ? (
            <button type="button" onClick={openStory} aria-haspopup="dialog" aria-controls={dialogId} className="mt-5 inline-flex min-h-11 items-center justify-center gap-3 rounded-full border border-[var(--supplier-outline)] px-5 py-2.5 text-sm font-semibold text-[var(--supplier-accent)] transition-colors hover:bg-[var(--supplier-primary)] hover:text-[var(--supplier-on-primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--supplier-outline)]">
              Leer nuestra historia <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          ) : null}

          {verified ? (
            <div className="mt-6 flex items-center gap-3 border-t border-[var(--supplier-heading)]/15 pt-5">
              <span className="supplier-surface-card flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--supplier-card-background)] text-[var(--supplier-accent)]"><Award size={23} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold text-[var(--supplier-heading)]">Certificado de Calidad</p>
                <p className="mt-0.5 text-xs text-[var(--supplier-muted)]">Verificado por Drooopy</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        onClose={restorePage}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )).filter((element) => element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="supplier-surface-card m-auto max-h-[90dvh] w-[92vw] max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--supplier-heading)]/15 bg-[var(--supplier-card-background)] p-0 text-[var(--supplier-text)] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--supplier-heading)]/15 px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--supplier-accent)]">Nuestra historia</p>
            <h2 id={dialogTitleId} className="break-words font-[family-name:var(--font-varela-round)] text-xl leading-snug text-[var(--supplier-heading)] sm:text-2xl">{effectiveTitle}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar nuestra historia" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--supplier-heading)]/20 text-[var(--supplier-heading)] transition-colors hover:bg-[var(--supplier-hover-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--supplier-outline)]"><X size={20} aria-hidden="true" /></button>
        </header>
        <div ref={storyBodyRef} tabIndex={0} role="region" aria-label="Historia completa" className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 text-base leading-7 text-[var(--supplier-muted)] sm:px-8 sm:py-8">
          {subtitle?.trim() ? <p className="mb-5 break-words text-lg font-medium text-[var(--supplier-accent)]">{subtitle.trim()}</p> : null}
          <div className="supplier-about-rich ql-editor" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </div>
      </dialog>
    </section>
  );
}
