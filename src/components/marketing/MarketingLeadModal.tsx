"use client";

import { X } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MarketingLeadForm } from "@/components/marketing/MarketingLeadForm";

type Props = {
  onClose: () => void;
  onLeadCreated: () => void;
  openerRef: RefObject<HTMLAnchorElement | null>;
};

export function MarketingLeadModal({ onClose, onLeadCreated, openerRef }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = openerRef.current;
    const pathname = window.location.pathname;

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.animate(
        [{ opacity: 0, transform: "translateY(12px) scale(0.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 180, easing: "ease-out" },
      );
    }

    const fitVisualViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport || viewport.height >= window.innerHeight - 100) {
        dialog.style.maxHeight = "";
        dialog.style.top = "";
        dialog.style.bottom = "";
        return;
      }
      dialog.style.maxHeight = `${Math.max(240, viewport.height - 24)}px`;
      dialog.style.top = `${viewport.offsetTop + 12}px`;
      dialog.style.bottom = "auto";
    };
    window.visualViewport?.addEventListener("resize", fitVisualViewport);
    window.visualViewport?.addEventListener("scroll", fitVisualViewport);
    fitVisualViewport();

    return () => {
      window.visualViewport?.removeEventListener("resize", fitVisualViewport);
      window.visualViewport?.removeEventListener("scroll", fitVisualViewport);
      dialog.close();
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      if (window.location.pathname === pathname) {
        window.scrollTo(0, scrollY);
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      }
    };
  }, [openerRef]);

  return createPortal(
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-modal-title"
      aria-describedby="agenda-modal-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[34rem] overflow-y-auto overscroll-contain rounded-[1.75rem] border-0 bg-white p-0 text-[#17251c] shadow-[0_30px_100px_-30px_rgba(0,35,17,0.55)] backdrop:bg-[#00190c]/70 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">Agenda Drooopy</p>
            <h2 id="agenda-modal-title" className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl leading-tight tracking-[-0.035em] text-[#004e28] sm:text-3xl">
              Comienza a recibir citas con Drooopy
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar formulario"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[#004e28]/15 text-[#004e28] hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p id="agenda-modal-description" className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">
          Déjanos tus datos y te explicamos cómo activar Agenda en tu negocio.
        </p>
        <div className="mt-5 border-t border-[#004e28]/10 pt-5 [&>form]:border-0 [&>form]:p-0 [&>form]:shadow-none">
          <MarketingLeadForm
            kind="agenda"
            submitLabel="Quiero recibir información de Agenda"
            onLeadCreated={onLeadCreated}
          />
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
