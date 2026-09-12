"use client";

import Image from "next/image";
import { CalendarDays, Clock3, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Menu, MenuDay, MenuItem } from "@/types/menu";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const dayNames: Record<MenuDay, string> = {
  0: "Lunes",
  1: "Martes",
  2: "Miércoles",
  3: "Jueves",
  4: "Viernes",
  5: "Sábado",
  6: "Domingo",
};

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function formatPrice(value: number | null): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? currencyFormatter.format(value)
    : null;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : value;
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return `${formatDate(start)} – ${formatDate(end)}`;

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${shortDateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`;
  }

  return `${dateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`;
}

function formatTime(value: string): string {
  const [hoursValue, minutesValue = "00"] = value.split(":");
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours)) return value.split(":").slice(0, 2).join(":");

  const period = hours >= 12 ? "p.m." : "a.m.";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutesValue.padStart(2, "0")} ${period}`;
}

function MenuImage({
  src,
  alt,
  sizes,
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  fit?: "cover" | "contain";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      className={fit === "contain" ? "object-contain" : "object-cover"}
      onError={() => setFailedSrc(src)}
    />
  );
}

type LightboxImage = {
  src: string;
  alt: string;
  name: string;
  price: string | null;
  description: string | null;
};

function MenuItemCard({
  item,
  onOpenImage,
}: {
  item: MenuItem;
  onOpenImage: (image: LightboxImage) => void;
}) {
  const thumbnail = item.image_thumbnail_url || item.image_url;
  const largeImage = item.image_url || item.image_thumbnail_url;
  const price = formatPrice(item.price);
  const showOldPrice =
    typeof item.old_price === "number" &&
    item.old_price > 0 &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.old_price > item.price;

  return (
    <article
      className={`group flex h-full min-w-0 gap-4 rounded-2xl border bg-white p-3 shadow-[0_14px_36px_-28px_rgba(0,78,40,0.55)] transition-shadow hover:shadow-[0_20px_44px_-28px_rgba(0,78,40,0.65)] ${
        item.is_available
          ? "border-[#004e28]/10"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      {thumbnail && largeImage ? (
        <button
          type="button"
          onClick={() =>
            onOpenImage({
              src: largeImage,
              alt: item.name,
              name: item.name,
              price,
              description: hasText(item.description)
                ? item.description.trim()
                : null,
            })
          }
          className={`relative h-28 w-28 shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-[#e8eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 sm:h-36 sm:w-36 md:h-40 md:w-40 ${
            item.is_available ? "" : "opacity-60 grayscale"
          }`}
          aria-label={`Ampliar imagen de ${item.name}`}
        >
          <MenuImage
            src={thumbnail}
            alt={item.name}
            sizes="(max-width: 639px) 112px, (max-width: 767px) 144px, 160px"
          />
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 font-[family-name:var(--font-varela-round)] text-base font-bold leading-snug text-[#004e28] sm:text-lg">
            {item.name}
          </h4>
          {!item.is_available ? (
            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-gray-700">
              Agotado
            </span>
          ) : null}
        </div>

        {hasText(item.description) ? (
          <p className="mt-2 text-sm leading-5 text-gray-600">
            {item.description.trim()}
          </p>
        ) : null}

        {hasText(item.label) ? (
          <p className="mt-2 w-fit rounded-full bg-[#168e00]/10 px-2.5 py-1 text-[0.7rem] font-bold text-[#168e00]">
            {item.label.trim()}
          </p>
        ) : null}

        {price ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-base font-black text-[#168e00] sm:text-lg">{price}</span>
            {showOldPrice ? (
              <span className="text-sm text-gray-400 line-through">
                {currencyFormatter.format(item.old_price as number)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PublicSupplierMenu({ menus }: { menus: Menu[] }) {
  const [selectedMenuId, setSelectedMenuId] = useState(menus[0]?.id ?? null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    if (!lightboxImage) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxImage(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightboxImage]);

  const selectedMenu =
    menus.find((menu) => menu.id === selectedMenuId) ?? menus[0];

  if (!selectedMenu) return null;

  const cover = selectedMenu.image_url || selectedMenu.image_thumbnail_url;
  const menuPrice =
    typeof selectedMenu.price === "number" && selectedMenu.price > 0
      ? formatPrice(selectedMenu.price)
      : null;
  const days = selectedMenu.days_of_week
    ?.filter((day): day is MenuDay => day in dayNames)
    .sort((first, second) => first - second)
    .map((day) => dayNames[day]);
  const hasDates =
    hasText(selectedMenu.date_start) || hasText(selectedMenu.date_end);
  const hasStartTime = hasText(selectedMenu.time_start);
  const hasEndTime = hasText(selectedMenu.time_end);
  const hasTimes =
    (hasStartTime || hasEndTime) &&
    !(hasStartTime && hasEndTime && selectedMenu.time_start === selectedMenu.time_end);

  return (
    <section aria-labelledby="public-menu-title" className="relative overflow-hidden bg-[#f2f3f4] py-10 md:py-14">
      <div className="pointer-events-none absolute -right-48 -top-48 h-96 w-96 rounded-full bg-[#168e00]/8 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        {menus.length > 1 ? (
          <div
            className="mb-5 flex gap-2 overflow-x-auto pb-2"
            role="tablist"
            aria-label="Seleccionar menú"
          >
            {menus.map((menu) => {
              const isSelected = menu.id === selectedMenu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedMenuId(menu.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 ${
                    isSelected
                      ? "bg-[#004e28] text-white shadow-lg"
                      : "border border-[#004e28]/10 bg-white text-[#004e28] hover:border-[#168e00] hover:text-[#168e00]"
                  }`}
                >
                  {menu.name}
                </button>
              );
            })}
          </div>
        ) : null}

        <article className="overflow-hidden rounded-2xl bg-[#004e28] text-white shadow-[0_24px_60px_-42px_rgba(0,78,40,0.9)]">
          <div className={cover ? "grid items-stretch md:grid-cols-[1fr_17rem]" : ""}>
            <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
              <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#7cde68]">
                Menú
              </p>
              <h2
                id="public-menu-title"
                className="font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight md:text-4xl"
              >
                {selectedMenu.name}
              </h2>
              {hasText(selectedMenu.description) ? (
                <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/75 md:text-base">
                  {selectedMenu.description.trim()}
                </p>
              ) : null}
              {menuPrice ? (
                <p className="mt-4 text-xl font-black text-[#7cde68]">
                  {menuPrice}
                </p>
              ) : null}

              {hasDates || days?.length || hasTimes ? (
                <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/75 sm:text-sm">
                  {hasDates ? (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Fechas</dt>
                      <CalendarDays className="h-4 w-4 shrink-0 text-[#7cde68]" aria-hidden="true" />
                      <dd className="leading-5">
                        {hasText(selectedMenu.date_start) && hasText(selectedMenu.date_end)
                          ? formatDateRange(selectedMenu.date_start, selectedMenu.date_end)
                          : hasText(selectedMenu.date_start)
                            ? `Desde ${formatDate(selectedMenu.date_start)}`
                            : `Hasta ${formatDate(selectedMenu.date_end as string)}`}
                      </dd>
                    </div>
                  ) : null}
                  {days?.length ? (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Días</dt>
                      <CalendarDays className="h-4 w-4 shrink-0 text-[#7cde68]" aria-hidden="true" />
                      <dd className="leading-5">{days.join(", ")}</dd>
                    </div>
                  ) : null}
                  {hasTimes ? (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Horario</dt>
                      <Clock3 className="h-4 w-4 shrink-0 text-[#7cde68]" aria-hidden="true" />
                      <dd className="leading-5">
                        {hasText(selectedMenu.time_start) && hasText(selectedMenu.time_end)
                          ? `${formatTime(selectedMenu.time_start)} – ${formatTime(selectedMenu.time_end)}`
                          : hasText(selectedMenu.time_start)
                            ? `Desde ${formatTime(selectedMenu.time_start)}`
                            : `Hasta ${formatTime(selectedMenu.time_end as string)}`}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>

            {cover ? (
              <button
                type="button"
                onClick={() =>
                  setLightboxImage({
                    src: cover,
                    alt: `Portada de ${selectedMenu.name}`,
                    name: selectedMenu.name,
                    price: menuPrice,
                    description: hasText(selectedMenu.description)
                      ? selectedMenu.description.trim()
                      : null,
                  })
                }
                className="relative min-h-48 cursor-zoom-in bg-[#003b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7cde68] md:min-h-56"
                aria-label={`Ampliar portada de ${selectedMenu.name}`}
              >
                <MenuImage
                  src={cover}
                  alt={`Portada de ${selectedMenu.name}`}
                  sizes="(max-width: 767px) calc(100vw - 40px), 272px"
                />
              </button>
            ) : null}
          </div>
        </article>

        <div className="mt-10 space-y-10">
          {selectedMenu.sections.map((section) => (
            <section key={section.id} aria-labelledby={`menu-section-${section.id}`} className="border-t border-[#004e28]/10 pt-7 first:border-0 first:pt-0">
              <header className="mb-4 max-w-3xl">
                <h3
                  id={`menu-section-${section.id}`}
                  className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]"
                >
                  {section.name}
                </h3>
                {hasText(section.description) ? (
                  <p className="mt-1.5 text-sm leading-6 text-gray-600">
                    {section.description.trim()}
                  </p>
                ) : null}
              </header>

              <div className="grid grid-cols-1 justify-start gap-4 md:grid-cols-[repeat(auto-fit,minmax(20rem,28rem))]">
                {section.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onOpenImage={setLightboxImage}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/90 p-4 opacity-100 backdrop-blur-sm transition-opacity duration-200 starting:opacity-0 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen ampliada: ${lightboxImage.alt}`}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-[85vw] max-w-6xl scale-100 flex-col overflow-hidden rounded-2xl bg-[#0d1712] shadow-2xl transition-transform duration-200 starting:scale-95"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cde68]"
              aria-label="Cerrar imagen ampliada"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="relative h-[68vh] max-h-[82vh] min-h-64 w-full bg-black">
              <MenuImage
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                sizes="85vw"
                fit="contain"
              />
            </div>

            <div className="shrink-0 border-t border-white/10 bg-[#0d1712] px-4 py-3 text-white sm:px-5 sm:py-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="min-w-0 font-[family-name:var(--font-varela-round)] text-base font-bold leading-snug sm:text-lg">
                  {lightboxImage.name}
                </h3>
                {lightboxImage.price ? (
                  <p className="shrink-0 text-sm font-black text-[#7cde68] sm:text-base">
                    {lightboxImage.price}
                  </p>
                ) : null}
              </div>
              {lightboxImage.description ? (
                <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-white/65 sm:text-sm">
                  {lightboxImage.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
