"use client";

import { Check, Loader2, X } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

type AgendaModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  saving: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function AgendaModalShell({
  open,
  title,
  description,
  saving,
  submitLabel = "Guardar",
  submitDisabled = false,
  onClose,
  onSubmit,
  children,
}: AgendaModalShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        focusableSelector,
      );
      focusable?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key !== "Tab") return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
          );
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2
              id={titleId}
              className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28] sm:text-2xl"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-gray-600">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Cerrar modal"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#168e00]/40 hover:bg-[#168e00]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-12 rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || submitDisabled}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white transition hover:bg-[#117500] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 aria-hidden="true" size={18} className="animate-spin" />
              ) : (
                <Check aria-hidden="true" size={18} />
              )}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
