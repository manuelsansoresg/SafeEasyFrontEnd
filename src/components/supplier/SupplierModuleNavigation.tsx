"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { agendaBookingService } from "@/services/agendaBookingService";
import type { AgendaService } from "@/types/agenda";
import type { Menu, MenuItem } from "@/types/menu";

export type SupplierPublicTab = "main" | "menu" | "products";

type SupplierModuleNavigationProps = {
  supplierId: number;
  menus: Menu[];
  isDirectory: boolean;
  activeTab: SupplierPublicTab;
  onChangeTab: (tab: SupplierPublicTab) => void;
  tabsRef: RefObject<HTMLDivElement | null>;
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function isOrderableItem(item: MenuItem) {
  return (
    item.is_active &&
    item.is_available &&
    typeof item.price === "number" &&
    Number.isFinite(item.price)
  );
}

export function SupplierModuleNavigation({
  supplierId,
  menus,
  isDirectory,
  activeTab,
  onChangeTab,
  tabsRef,
}: SupplierModuleNavigationProps) {
  const [agendaServices, setAgendaServices] = useState<AgendaService[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadAgenda = async () => {
      setAgendaLoading(true);

      try {
        const services =
          await agendaBookingService.listPublicServices(
            supplierId,
            controller.signal,
          );

        if (controller.signal.aborted) return;

        setAgendaServices(
          services
            .filter((service) => service.is_active)
            .sort(
              (first, second) =>
                first.display_order - second.display_order ||
                first.id - second.id,
            ),
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setAgendaServices([]);
      } finally {
        if (!controller.signal.aborted) {
          setAgendaLoading(false);
        }
      }
    };

    void loadAgenda();

    return () => controller.abort();
  }, [supplierId]);

  const agendaAvailable = agendaServices.length > 0;
  const hasMenu = menus.length > 0;
  const showNavigation = !isDirectory || hasMenu || agendaAvailable;

  const menuPreview = menus[0] ?? null;

  const menuItems = useMemo(() => {
    if (!menuPreview) return [];

    return menuPreview.sections
      .flatMap((section) => section.items)
      .filter((item) => item.is_active)
      .slice(0, 4);
  }, [menuPreview]);

  const totalMenuItems = useMemo(
    () =>
      menus.reduce(
        (menuTotal, menu) =>
          menuTotal +
          menu.sections.reduce(
            (sectionTotal, section) =>
              sectionTotal +
              section.items.filter((item) => item.is_active).length,
            0,
          ),
        0,
      ),
    [menus],
  );

  const orderableMenuItems = useMemo(
    () =>
      menus.reduce(
        (menuTotal, menu) =>
          menuTotal +
          menu.sections.reduce(
            (sectionTotal, section) =>
              sectionTotal +
              section.items.filter(isOrderableItem).length,
            0,
          ),
        0,
      ),
    [menus],
  );

  const openTab = (tab: SupplierPublicTab) => {
    onChangeTab(tab);

    window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <>
      {showNavigation ? (
        <div
          ref={tabsRef}
          className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md"
        >
          <div className="container mx-auto px-4 md:px-8">
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
                <Link
                  href={`/agenda/${supplierId}`}
                  className="whitespace-nowrap border-b-2 border-transparent px-2 py-4 font-bold text-gray-500 transition-colors hover:text-[#004e28]"
                >
                  Agenda
                </Link>
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

      {activeTab === "main" &&
      (hasMenu || agendaAvailable || agendaLoading) ? (
        <section
          aria-labelledby="supplier-actions-title"
          className="relative overflow-hidden bg-white py-12 md:py-16"
        >
          <div className="pointer-events-none absolute -right-40 -top-48 h-96 w-96 rounded-full bg-[#168e00]/5 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-5 md:px-8">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#168e00]">
                Explora este negocio
              </p>

              <h2
                id="supplier-actions-title"
                className="mt-2 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] md:text-4xl"
              >
                ¿Qué quieres hacer?
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600 md:text-base">
                Accede rápidamente a las opciones disponibles de este negocio.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {hasMenu && menuPreview ? (
                <article className="group overflow-hidden rounded-[2rem] border border-[#004e28]/10 bg-[#f7faf8] shadow-[0_22px_60px_-42px_rgba(0,78,40,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_65px_-38px_rgba(0,78,40,0.65)]">
                  <div className="bg-gradient-to-br from-[#004e28] to-[#09693a] p-6 text-white sm:p-7">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                      <UtensilsCrossed size={24} />
                    </span>

                    <p className="mt-5 text-xs font-black uppercase tracking-[0.17em] text-white/65">
                      Menú
                    </p>

                    <h3 className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-black sm:text-3xl">
                      {menus.length > 1
                        ? `${menus.length} menús disponibles`
                        : menuPreview.name}
                    </h3>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                      Consulta los platillos, precios y opciones disponibles.
                    </p>
                  </div>

                  <div className="p-6 sm:p-7">
                    {menus.length > 1 ? (
                      <div className="mb-5 flex flex-wrap gap-2">
                        {menus.slice(0, 4).map((menu) => (
                          <span
                            key={menu.id}
                            className="rounded-full bg-[#004e28]/7 px-3 py-1.5 text-xs font-bold text-[#004e28]"
                          >
                            {menu.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {menuItems.length > 0 ? (
                      <div className="divide-y divide-[#004e28]/7">
                        {menuItems.map((item) => (
                          <div
                            key={`${item.section_id}-${item.id}`}
                            className="flex items-center justify-between gap-4 py-3 first:pt-0"
                          >
                            <span className="min-w-0 truncate text-sm font-semibold text-gray-800">
                              {item.name}
                            </span>

                            {typeof item.price === "number" &&
                            Number.isFinite(item.price) ? (
                              <span className="shrink-0 text-sm font-black text-[#168e00]">
                                {currencyFormatter.format(item.price)}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Abre el menú para conocer todas las opciones.
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-gray-500">
                      <span>{totalMenuItems} platillos publicados</span>

                      {orderableMenuItems > 0 ? (
                        <span className="text-[#168e00]">
                          {orderableMenuItems} disponibles para pedido
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => openTab("menu")}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#117500] sm:w-auto"
                    >
                      Ver menú completo
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </article>
              ) : null}

              {agendaAvailable ? (
                <article className="group overflow-hidden rounded-[2rem] border border-[#168e00]/15 bg-white shadow-[0_22px_60px_-42px_rgba(0,78,40,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_65px_-38px_rgba(0,78,40,0.65)]">
                  <div className="bg-gradient-to-br from-[#eaf7e8] via-[#f8fcf7] to-white p-6 sm:p-7">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
                      <CalendarDays size={24} />
                    </span>

                    <p className="mt-5 text-xs font-black uppercase tracking-[0.17em] text-[#168e00]">
                      Agenda
                    </p>

                    <h3 className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-black text-[#004e28] sm:text-3xl">
                      Agenda disponible
                    </h3>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                      Elige el servicio, día y horario que mejor te funcione.
                      Consulta la disponibilidad y reserva directamente.
                    </p>
                  </div>

                  <div className="p-6 sm:p-7">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">
                        Servicios disponibles
                      </p>

                      <span className="rounded-full bg-[#168e00]/8 px-2.5 py-1 text-xs font-bold text-[#168e00]">
                        {agendaServices.length}
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {agendaServices.slice(0, 3).map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between gap-4 py-3 first:pt-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#004e28]">
                              {service.name}
                            </p>

                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                              <Clock3 size={12} />
                              {service.duration_minutes} min
                            </p>
                          </div>

                          {typeof service.price === "number" &&
                          Number.isFinite(service.price) ? (
                            <span className="shrink-0 text-sm font-black text-[#168e00]">
                              {currencyFormatter.format(service.price)}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <Link
                      href={`/agenda/${supplierId}`}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#003b1f] sm:w-auto"
                    >
                      <CalendarDays size={17} />
                      Agendar ahora
                    </Link>
                  </div>
                </article>
              ) : agendaLoading ? (
                <article className="rounded-[2rem] border border-[#004e28]/10 bg-white p-7 shadow-[0_22px_60px_-42px_rgba(0,78,40,0.45)]">
                  <div className="flex items-center gap-3 text-sm font-bold text-[#004e28]">
                    <Loader2 size={18} className="animate-spin text-[#168e00]" />
                    Consultando agenda
                  </div>

                  <div className="mt-5 h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
                  <div className="mt-3 h-4 w-full max-w-sm animate-pulse rounded bg-gray-100" />
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                </article>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
