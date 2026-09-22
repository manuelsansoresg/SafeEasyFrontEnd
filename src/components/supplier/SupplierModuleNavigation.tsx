"use client";

import {
  CalendarDays,
  ChevronRight,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";
import {
  useEffect,
  useState,
  type RefObject,
} from "react";
import { agendaBookingService } from "@/services/agendaBookingService";

export type SupplierPublicTab =
  | "main"
  | "menu"
  | "agenda"
  | "products";

type SupplierModuleNavigationProps = {
  supplierId: number;
  hasMenu: boolean;
  isDirectory: boolean;
  activeTab: SupplierPublicTab;
  onChangeTab: (tab: SupplierPublicTab, replace?: boolean) => void;
  tabsRef: RefObject<HTMLDivElement | null>;
};

export function SupplierModuleNavigation({
  supplierId,
  hasMenu,
  isDirectory,
  activeTab,
  onChangeTab,
  tabsRef,
}: SupplierModuleNavigationProps) {
  const [agendaAvailable, setAgendaAvailable] =
    useState(false);
  const [agendaLoading, setAgendaLoading] =
    useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadAgenda = async () => {
      setAgendaLoading(true);

      try {
        await agendaBookingService.listPublicServices(
          supplierId,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        // Una respuesta correcta significa que el negocio tiene Agenda
        // publicada. La pestaña no debe desaparecer sólo porque el proveedor
        // todavía no ha creado su primer servicio.
        setAgendaAvailable(true);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setAgendaAvailable(false);
      } finally {
        if (!controller.signal.aborted) {
          setAgendaLoading(false);
        }
      }
    };

    void loadAgenda();

    return () => controller.abort();
  }, [supplierId]);

  useEffect(() => {
    if (
      activeTab === "agenda" &&
      !agendaLoading &&
      !agendaAvailable
    ) {
      onChangeTab("main", true);
    }
  }, [
    activeTab,
    agendaAvailable,
    agendaLoading,
    onChangeTab,
  ]);

  const openTab = (tab: SupplierPublicTab) => {
    onChangeTab(tab);

    window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const showTabs =
    !isDirectory ||
    hasMenu ||
    agendaAvailable ||
    agendaLoading;

  const showModuleAccess =
    activeTab === "main" &&
    (hasMenu || agendaAvailable || agendaLoading);

  return (
    <>
      {showTabs ? (
        <div
          ref={tabsRef}
          className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="flex gap-8 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => openTab("main")}
                className={`whitespace-nowrap border-b-2 px-2 py-4 font-bold transition-colors ${
                  activeTab === "main"
                    ? "border-[#168e00] text-[#004e28]"
                    : "border-transparent text-gray-500 hover:text-[#004e28]"
                }`}
              >
                Página Principal
              </button>

              {hasMenu ? (
                <button
                  type="button"
                  onClick={() => openTab("menu")}
                  className={`whitespace-nowrap border-b-2 px-2 py-4 font-bold transition-colors ${
                    activeTab === "menu"
                      ? "border-[#168e00] text-[#004e28]"
                      : "border-transparent text-gray-500 hover:text-[#004e28]"
                  }`}
                >
                  Menú
                </button>
              ) : null}

              {agendaAvailable ? (
                <button
                  type="button"
                  onClick={() => openTab("agenda")}
                  className={`whitespace-nowrap border-b-2 px-2 py-4 font-bold transition-colors ${
                    activeTab === "agenda"
                      ? "border-[#168e00] text-[#004e28]"
                      : "border-transparent text-gray-500 hover:text-[#004e28]"
                  }`}
                >
                  Agenda
                </button>
              ) : null}

              {!isDirectory ? (
                <button
                  type="button"
                  onClick={() => openTab("products")}
                  className={`whitespace-nowrap border-b-2 px-2 py-4 font-bold transition-colors ${
                    activeTab === "products"
                      ? "border-[#168e00] text-[#004e28]"
                      : "border-transparent text-gray-500 hover:text-[#004e28]"
                  }`}
                >
                  Productos
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showModuleAccess ? (
        <section
          aria-labelledby="module-access-title"
          className="border-b border-gray-100 bg-[#f7f9f8] py-10 md:py-12"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#168e00]">
                Accesos rápidos
              </p>
              <h2
                id="module-access-title"
                className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-black text-[#004e28] md:text-3xl"
              >
                ¿Qué quieres consultar?
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {hasMenu ? (
                <button
                  type="button"
                  onClick={() => openTab("menu")}
                  className="group flex min-h-28 items-center gap-4 rounded-3xl border border-[#004e28]/10 bg-white p-5 text-left shadow-[0_16px_35px_-30px_rgba(0,78,40,0.6)] transition hover:-translate-y-0.5 hover:border-[#168e00]/35 hover:shadow-[0_20px_45px_-28px_rgba(0,78,40,0.6)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
                    <UtensilsCrossed size={24} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">
                      Ver menú
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-gray-500">
                      Consulta platillos, precios y disponibilidad.
                    </span>
                  </span>

                  <ChevronRight
                    size={20}
                    className="shrink-0 text-[#168e00] transition-transform group-hover:translate-x-1"
                  />
                </button>
              ) : null}

              {agendaLoading ? (
                <div className="flex min-h-28 items-center gap-4 rounded-3xl border border-[#004e28]/10 bg-white p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
                    <Loader2
                      size={23}
                      className="animate-spin"
                    />
                  </span>

                  <span>
                    <span className="block font-bold text-[#004e28]">
                      Consultando agenda
                    </span>
                    <span className="mt-1 block text-sm text-gray-500">
                      Revisando si este negocio acepta citas.
                    </span>
                  </span>
                </div>
              ) : agendaAvailable ? (
                <button
                  type="button"
                  onClick={() => openTab("agenda")}
                  className="group flex min-h-28 items-center gap-4 rounded-3xl border border-[#004e28]/10 bg-white p-5 text-left shadow-[0_16px_35px_-30px_rgba(0,78,40,0.6)] transition hover:-translate-y-0.5 hover:border-[#168e00]/35 hover:shadow-[0_20px_45px_-28px_rgba(0,78,40,0.6)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#004e28]/8 text-[#004e28]">
                    <CalendarDays size={24} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">
                      Ver agenda
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-gray-500">
                      Consulta servicios y entra a la pestaña de agenda.
                    </span>
                  </span>

                  <ChevronRight
                    size={20}
                    className="shrink-0 text-[#168e00] transition-transform group-hover:translate-x-1"
                  />
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
