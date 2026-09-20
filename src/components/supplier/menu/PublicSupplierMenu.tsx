"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Facebook,
  Loader2,
  LogIn,
  Minus,
  Plus,
  Send,
  Share2,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  getBrowserPathWithSearchAndHash,
  getLoginUrl,
} from "@/lib/authRedirect";
import { menuOrderService } from "@/services/menuOrderService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  Menu,
  MenuDay,
  MenuItem,
} from "@/types/menu";
import type {
  MenuOrderFulfillmentType,
  MenuOrderSettings,
} from "@/types/menuOrder";

const currencyFormatter =
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

const dateFormatter =
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const shortDateFormatter =
  new Intl.DateTimeFormat("es-MX", {
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

function hasText(
  value: string | null | undefined,
): value is string {
  return Boolean(value?.trim());
}

function formatPrice(
  value: number | null,
): string | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? currencyFormatter.format(value)
    : null;
}

function parseDate(
  value: string,
): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})/.exec(
      value,
    );

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
    ),
  );
}

function formatDate(value: string): string {
  const date = parseDate(value);

  return date
    ? dateFormatter.format(date)
    : value;
}

function formatDateRange(
  start: string,
  end: string,
): string {
  if (start === end) {
    return formatDate(start);
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) {
    return `${formatDate(
      start,
    )} – ${formatDate(end)}`;
  }

  if (
    startDate.getUTCFullYear() ===
    endDate.getUTCFullYear()
  ) {
    return `${shortDateFormatter.format(
      startDate,
    )} – ${dateFormatter.format(
      endDate,
    )}`;
  }

  return `${dateFormatter.format(
    startDate,
  )} – ${dateFormatter.format(
    endDate,
  )}`;
}

function formatTime(
  value: string,
): string {
  const [
    hoursValue,
    minutesValue = "00",
  ] = value.split(":");

  const hours = Number(hoursValue);

  if (!Number.isFinite(hours)) {
    return value
      .split(":")
      .slice(0, 2)
      .join(":");
  }

  const period =
    hours >= 12 ? "p.m." : "a.m.";

  const displayHours =
    hours % 12 || 12;

  return `${displayHours}:${minutesValue.padStart(
    2,
    "0",
  )} ${period}`;
}

function createRequestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `menu-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
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
  const [failedSrc, setFailedSrc] =
    useState<string | null>(null);

  if (!src || failedSrc === src) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      className={
        fit === "contain"
          ? "object-contain"
          : "object-cover"
      }
      onError={() =>
        setFailedSrc(src)
      }
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

type CartLine = {
  item: MenuItem;
  quantity: number;
  notes: string;
};

/* =========================================================
   TARJETA DE PRODUCTO
   Foto arriba + información abajo
   ========================================================= */

function MenuItemCard({
  item,
  quantity,
  canOrder,
  onOpenImage,
  onAdd,
  onDecrease,
}: {
  item: MenuItem;
  quantity: number;
  canOrder: boolean;
  onOpenImage: (
    image: LightboxImage,
  ) => void;
  onAdd: () => void;
  onDecrease: () => void;
}) {
  const thumbnail =
    item.image_thumbnail_url ||
    item.image_url;

  const largeImage =
    item.image_url ||
    item.image_thumbnail_url;

  const price = formatPrice(
    item.price,
  );

  const showOldPrice =
    typeof item.old_price ===
      "number" &&
    item.old_price > 0 &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.old_price > item.price;

  return (
    <article
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        item.is_available
          ? "border-[#004e28]/10"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      {thumbnail &&
      largeImage ? (
        <button
          type="button"
          onClick={() =>
            onOpenImage({
              src: largeImage,
              alt: item.name,
              name: item.name,
              price,
              description: hasText(
                item.description,
              )
                ? item.description.trim()
                : null,
            })
          }
          className={`relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-[#e8eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#168e00] ${
            item.is_available
              ? ""
              : "opacity-60 grayscale"
          }`}
          aria-label={`Ampliar imagen de ${item.name}`}
        >
          <MenuImage
            src={thumbnail}
            alt={item.name}
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw"
          />
        </button>
      ) : (
        <div
          className={`flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-[#edf3ee] to-[#e5eee7] ${
            item.is_available
              ? ""
              : "opacity-60 grayscale"
          }`}
        >
          <UtensilsCrossed
            size={34}
            strokeWidth={1.4}
            className="text-[#004e28]/25"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 min-w-0 flex-1 font-[family-name:var(--font-varela-round)] text-sm font-bold leading-snug text-[#004e28] sm:text-base">
            {item.name}
          </h4>

          {!item.is_available ? (
            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-1 text-[0.58rem] font-bold uppercase tracking-wide text-gray-700">
              Agotado
            </span>
          ) : null}
        </div>

        {hasText(
          item.description,
        ) ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500 sm:text-sm">
            {item.description.trim()}
          </p>
        ) : null}

        {hasText(item.label) ? (
          <span className="mt-2 w-fit rounded-full bg-[#168e00]/10 px-2 py-1 text-[0.65rem] font-bold text-[#168e00]">
            {item.label.trim()}
          </span>
        ) : null}

        <div className="mt-auto pt-3">
          {price ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-black text-[#168e00] sm:text-lg">
                {price}
              </span>

              {showOldPrice ? (
                <span className="text-xs text-gray-400 line-through">
                  {currencyFormatter.format(
                    item.old_price as number,
                  )}
                </span>
              ) : null}
            </div>
          ) : null}

          {canOrder ? (
            <div className="mt-3">
              {quantity > 0 ? (
                <div className="flex w-full items-center justify-between rounded-xl border border-[#168e00]/20 bg-[#168e00]/5 p-1">
                  <button
                    type="button"
                    onClick={
                      onDecrease
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#004e28] transition hover:bg-white"
                    aria-label={`Quitar una unidad de ${item.name}`}
                  >
                    <Minus
                      size={15}
                    />
                  </button>

                  <span className="min-w-8 text-center text-sm font-black text-[#004e28]">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={onAdd}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#168e00] text-white transition hover:bg-[#117500]"
                    aria-label={`Agregar una unidad de ${item.name}`}
                  >
                    <Plus
                      size={15}
                    />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAdd}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#168e00] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#117500]"
                >
                  <Plus
                    size={15}
                  />
                  Agregar
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PublicSupplierMenu({
  menus,
}: {
  menus: Menu[];
}) {
  const params =
    useParams<{
      slug: string;
    }>();

  const router = useRouter();

  const {
    user,
    isAuthenticated,
  } = useAuthStore();

  const supplierSlug = String(
    params?.slug || "",
  );

  const [
    selectedMenuId,
    setSelectedMenuId,
  ] = useState(
    menus[0]?.id ?? null,
  );

  const [
    lightboxImage,
    setLightboxImage,
  ] =
    useState<LightboxImage | null>(
      null,
    );

  const [
    orderSettingsByMenu,
    setOrderSettingsByMenu,
  ] = useState<Record<number, MenuOrderSettings>>({});

  const [
    settingsLoading,
    setSettingsLoading,
  ] = useState(false);

  const [cart, setCart] =
    useState<
      Record<number, CartLine>
    >({});

  const [
    cartOpen,
    setCartOpen,
  ] = useState(false);

  const [
    checkoutOpen,
    setCheckoutOpen,
  ] = useState(false);

  const [
    shareOpen,
    setShareOpen,
  ] = useState(false);

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    checkoutError,
    setCheckoutError,
  ] =
    useState<string | null>(null);

  const [
    clientRequestId,
    setClientRequestId,
  ] = useState(
    createRequestId,
  );

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState("");

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState("");

  const [
    fulfillmentType,
    setFulfillmentType,
  ] =
    useState<MenuOrderFulfillmentType>(
      "pickup",
    );

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] = useState("");

  const [
    generalNotes,
    setGeneralNotes,
  ] = useState("");

  useEffect(() => {
    if (!user) return;

    setCustomerName(
      (current) =>
        current ||
        user.name ||
        "",
    );

    setCustomerEmail(
      (current) =>
        current ||
        user.email ||
        "",
    );
  }, [user]);

  useEffect(() => {
    const query =
      new URLSearchParams(
        window.location.search,
      );

    const menuFromUrl =
      Number(
        query.get("menu"),
      );

    if (
      Number.isFinite(
        menuFromUrl,
      ) &&
      menus.some(
        (menu) =>
          menu.id ===
          menuFromUrl,
      )
    ) {
      setSelectedMenuId(
        menuFromUrl,
      );
    }
  }, [menus]);

  const selectedMenu =
    menus.find(
      (menu) =>
        menu.id ===
        selectedMenuId,
    ) ?? menus[0];

  useEffect(() => {
    if (
      !supplierSlug ||
      menus.length === 0
    ) {
      setOrderSettingsByMenu({});
      return;
    }

    const controller =
      new AbortController();

    setSettingsLoading(true);

    Promise.all(
      menus.map(async (menu) => {
        try {
          const settings =
            await menuOrderService.publicSettings(
              supplierSlug,
              menu.id,
              controller.signal,
            );

          return [
            menu.id,
            settings,
          ] as const;
        } catch (error: unknown) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            throw error;
          }

          console.error(
            `No se pudo consultar la configuración de pedidos del menú ${menu.id}:`,
            error,
          );

          return [
            menu.id,
            {
              menu_id: menu.id,
              supplier_id:
                menu.supplier_id,
              accepts_orders:
                false,
              allows_pickup:
                true,
              allows_delivery:
                false,
              allow_guest_orders:
                true,
            } satisfies MenuOrderSettings,
          ] as const;
        }
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) {
          return;
        }

        setOrderSettingsByMenu(
          Object.fromEntries(
            entries,
          ),
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        console.error(
          "No se pudieron consultar las configuraciones de pedidos:",
          error,
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted
        ) {
          setSettingsLoading(
            false,
          );
        }
      });

    return () =>
      controller.abort();
  }, [
    menus,
    supplierSlug,
  ]);

  const orderSettings =
    selectedMenu
      ? orderSettingsByMenu[
          selectedMenu.id
        ] ?? null
      : null;

  const hasAnyOrderMenu =
    useMemo(
      () =>
        Object.values(
          orderSettingsByMenu,
        ).some(
          (settings) =>
            settings.accepts_orders,
        ),
      [orderSettingsByMenu],
    );

  useEffect(() => {
    setCart({});
    setCartOpen(false);
    setCheckoutOpen(false);
  }, [selectedMenu?.id]);

  useEffect(() => {
    if (!orderSettings) {
      return;
    }

    if (
      orderSettings.allows_pickup
    ) {
      setFulfillmentType(
        "pickup",
      );
    } else if (
      orderSettings.allows_delivery
    ) {
      setFulfillmentType(
        "delivery",
      );
    }
  }, [orderSettings]);

  useEffect(() => {
    const modalOpen =
      Boolean(
        lightboxImage ||
          cartOpen ||
          checkoutOpen ||
          shareOpen,
      );

    if (!modalOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    const closeOnEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      setLightboxImage(
        null,
      );

      setCartOpen(false);
      setCheckoutOpen(
        false,
      );

      setShareOpen(false);
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [
    lightboxImage,
    cartOpen,
    checkoutOpen,
    shareOpen,
  ]);

  const cartItems =
    useMemo(
      () =>
        Object.values(
          cart,
        ),
      [cart],
    );

  const cartQuantity =
    useMemo(
      () =>
        cartItems.reduce(
          (
            sum,
            line,
          ) =>
            sum +
            line.quantity,
          0,
        ),
      [cartItems],
    );

  const cartSubtotal =
    useMemo(
      () =>
        cartItems.reduce(
          (
            sum,
            line,
          ) =>
            sum +
            Number(
              line.item
                .price ||
                0,
            ) *
              line.quantity,
          0,
        ),
      [cartItems],
    );

  if (!selectedMenu) {
    return null;
  }

  const cover =
    selectedMenu.image_url ||
    selectedMenu.image_thumbnail_url;

  const menuPrice =
    typeof selectedMenu.price ===
      "number" &&
    selectedMenu.price > 0
      ? formatPrice(
          selectedMenu.price,
        )
      : null;

  const days =
    selectedMenu.days_of_week
      ?.filter(
        (
          day,
        ): day is MenuDay =>
          Object.prototype.hasOwnProperty.call(
            dayNames,
            day,
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          first -
          second,
      )
      .map(
        (day) =>
          dayNames[day],
      );

  const hasDates =
    hasText(
      selectedMenu.date_start,
    ) ||
    hasText(
      selectedMenu.date_end,
    );

  const hasStartTime =
    hasText(
      selectedMenu.time_start,
    );

  const hasEndTime =
    hasText(
      selectedMenu.time_end,
    );

  const hasTimes =
    (hasStartTime ||
      hasEndTime) &&
    !(
      hasStartTime &&
      hasEndTime &&
      selectedMenu.time_start ===
        selectedMenu.time_end
    );

  const acceptsOrders =
    Boolean(
      orderSettings?.accepts_orders,
    );

  const allowsGuestOrders =
    Boolean(
      orderSettings?.allow_guest_orders,
    );

  const canCurrentUserOrder =
    acceptsOrders &&
    (isAuthenticated ||
      allowsGuestOrders);

  const hasOrderableItems =
    useMemo(
      () =>
        Boolean(
          selectedMenu?.sections.some(
            (section) =>
              section.items.some(
                (item) =>
                  item.is_available &&
                  typeof item.price ===
                    "number" &&
                  Number.isFinite(
                    item.price,
                  ),
              ),
          ),
        ),
      [selectedMenu],
    );

  const goToLoginForOrder =
    () => {
      router.push(
        getLoginUrl(
          getBrowserPathWithSearchAndHash(),
        ),
      );
    };

  const changeQuantity = (
    item: MenuItem,
    delta: number,
  ) => {
    if (
      !item.is_available ||
      typeof item.price !==
        "number"
    ) {
      return;
    }

    setCart(
      (current) => {
        const existing =
          current[
            item.id
          ];

        const quantity =
          Math.max(
            0,
            Math.min(
              99,
              (existing?.quantity ||
                0) +
                delta,
            ),
          );

        const next = {
          ...current,
        };

        if (
          quantity === 0
        ) {
          delete next[
            item.id
          ];
        } else {
          next[item.id] =
            {
              item,
              quantity,
              notes:
                existing?.notes ||
                "",
            };
        }

        return next;
      },
    );
  };

  const updateLineNotes = (
    itemId: number,
    notes: string,
  ) => {
    setCart(
      (current) => {
        const line =
          current[
            itemId
          ];

        if (!line) {
          return current;
        }

        return {
          ...current,
          [itemId]: {
            ...line,
            notes,
          },
        };
      },
    );
  };

  const removeLine = (
    itemId: number,
  ) => {
    setCart(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          itemId
        ];

        return next;
      },
    );
  };

  const openCheckout =
    () => {
      if (
        !cartItems.length ||
        !orderSettings?.accepts_orders
      ) {
        return;
      }

      if (
        !isAuthenticated &&
        !orderSettings.allow_guest_orders
      ) {
        goToLoginForOrder();
        return;
      }

      setCheckoutError(
        null,
      );

      setClientRequestId(
        createRequestId(),
      );

      if (
        orderSettings.allows_pickup
      ) {
        setFulfillmentType(
          "pickup",
        );
      } else if (
        orderSettings.allows_delivery
      ) {
        setFulfillmentType(
          "delivery",
        );
      }

      setCartOpen(false);
      setCheckoutOpen(
        true,
      );
    };

  const submitOrder =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !orderSettings?.accepts_orders ||
        !supplierSlug ||
        !cartItems.length
      ) {
        return;
      }

      if (
        !isAuthenticated &&
        !orderSettings.allow_guest_orders
      ) {
        goToLoginForOrder();
        return;
      }

      if (
        !customerName.trim() ||
        !customerEmail.trim() ||
        !customerPhone.trim()
      ) {
        setCheckoutError(
          "Completa tu nombre, correo y teléfono.",
        );
        return;
      }

      if (
        fulfillmentType ===
          "delivery" &&
        !deliveryAddress.trim()
      ) {
        setCheckoutError(
          "Escribe la dirección para la entrega.",
        );
        return;
      }

      setSubmitting(true);
      setCheckoutError(null);

      try {
        const order =
          await menuOrderService.createPublic(
            supplierSlug,
            {
              menu_id:
                selectedMenu.id,
              customer_name:
                customerName.trim(),
              customer_email:
                customerEmail.trim(),
              customer_phone:
                customerPhone.trim(),
              fulfillment_type:
                fulfillmentType,
              delivery_address:
                fulfillmentType ===
                "delivery"
                  ? deliveryAddress.trim()
                  : null,
              notes:
                generalNotes.trim() ||
                null,
              client_request_id:
                clientRequestId,
              items:
                cartItems.map(
                  (line) => ({
                    menu_item_id:
                      line.item
                        .id,
                    quantity:
                      line.quantity,
                    notes:
                      line.notes.trim() ||
                      null,
                  }),
                ),
            },
          );

        try {
          window.localStorage.setItem(
            `menu-order-token:${order.order_number}`,
            order.management_token,
          );
        } catch {
          // El enlace también lleva el token.
        }

        setCheckoutOpen(
          false,
        );

        setCart({});

        router.push(
          `/pedidos/menu/${encodeURIComponent(
            order.order_number,
          )}?management_token=${encodeURIComponent(
            order.management_token,
          )}`,
        );
      } catch (error) {
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "No se pudo crear el pedido.",
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  const shareUrl = () => {
    const url =
      new URL(
        window.location.href,
      );

    url.searchParams.set(
      "menu",
      String(
        selectedMenu.id,
      ),
    );

    url.hash = "menu";

    return url.toString();
  };

  const shareText =
    `Mira el menú ${selectedMenu.name}`;

  const openShareUrl = (
    url: string,
  ) => {
    window.open(
      url,
      "_blank",
      "noopener,noreferrer,width=760,height=640",
    );
  };

  const copyShareUrl =
    async () => {
      const url =
        shareUrl();

      try {
        await navigator.clipboard.writeText(
          url,
        );
      } catch {
        const textarea =
          document.createElement(
            "textarea",
          );

        textarea.value =
          url;

        textarea.style.position =
          "fixed";

        textarea.style.opacity =
          "0";

        document.body.appendChild(
          textarea,
        );

        textarea.select();

        document.execCommand(
          "copy",
        );

        textarea.remove();
      }

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1800,
      );
    };

  const nativeShare =
    async () => {
      if (!navigator.share) {
        await copyShareUrl();
        return;
      }

      try {
        await navigator.share({
          title:
            selectedMenu.name,
          text: shareText,
          url: shareUrl(),
        });
      } catch {
        // Cerrar el diálogo nativo no es un error.
      }
    };

  return (
    <section
      id="menu"
      aria-labelledby="public-menu-title"
      className="relative scroll-mt-24 overflow-hidden bg-[#f2f3f4] py-14 md:py-20"
    >
      <div className="pointer-events-none absolute -right-52 -top-52 h-[30rem] w-[30rem] rounded-full bg-[#168e00]/10 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 md:px-8">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#168e00]">
              Descubre nuestra propuesta
            </p>

            <h2
              id="public-menu-title"
              className="mt-1 font-[family-name:var(--font-varela-round)] text-4xl font-black text-[#004e28] md:text-5xl"
            >
              Menú
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAuthenticated &&
            !settingsLoading &&
            hasAnyOrderMenu ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/client/menu-orders",
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-[#004e28]/10 bg-white px-4 py-3 text-sm font-bold text-[#004e28] shadow-sm hover:border-[#168e00]/40"
              >
                <ShoppingBag
                  size={17}
                />
                Mis pedidos
              </button>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setShareOpen(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-[#004e28]/10 bg-white px-4 py-3 text-sm font-bold text-[#004e28] shadow-sm hover:border-[#168e00]/40"
            >
              <Share2
                size={17}
              />
              Compartir
            </button>

            {acceptsOrders ? (
              canCurrentUserOrder ? (
                <button
                  type="button"
                  onClick={() =>
                    setCartOpen(
                      true,
                    )
                  }
                  className="relative inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#117500]"
                >
                  <ShoppingBag
                    size={17}
                  />
                  Pedido

                  {cartQuantity >
                  0 ? (
                    <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs font-black text-[#168e00]">
                      {
                        cartQuantity
                      }
                    </span>
                  ) : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    goToLoginForOrder
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#003b1f]"
                >
                  <LogIn
                    size={17}
                  />
                  Inicia sesión
                  para pedir
                </button>
              )
            ) : null}
          </div>
        </div>

        {menus.length > 1 ? (
          <div
            className="mb-5 flex gap-2 overflow-x-auto pb-2"
            role="tablist"
            aria-label="Seleccionar menú"
          >
            {menus.map(
              (menu) => {
                const isSelected =
                  menu.id ===
                  selectedMenu.id;

                return (
                  <button
                    key={
                      menu.id
                    }
                    type="button"
                    role="tab"
                    aria-selected={
                      isSelected
                    }
                    onClick={() =>
                      setSelectedMenuId(
                        menu.id,
                      )
                    }
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 ${
                      isSelected
                        ? "bg-[#004e28] text-white shadow-lg"
                        : "border border-[#004e28]/10 bg-white text-[#004e28] hover:border-[#168e00] hover:text-[#168e00]"
                    }`}
                  >
                    {
                      menu.name
                    }
                  </button>
                );
              },
            )}
          </div>
        ) : null}

        <article className="overflow-hidden rounded-[28px] border border-[#004e28]/10 bg-white shadow-[0_24px_70px_-50px_rgba(0,78,40,0.8)]">
          <div className="h-1.5 bg-[#168e00]" />

          <div
            className={
              cover
                ? "grid items-stretch lg:grid-cols-[1fr_22rem]"
                : ""
            }
          >
            <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#168e00]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#168e00]">
                  Menú
                  disponible
                </span>

                {settingsLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                    Consultando
                    pedidos
                  </span>
                ) : acceptsOrders ? (
                  <span className="rounded-full bg-[#004e28]/10 px-3 py-1 text-xs font-bold text-[#004e28]">
                    {canCurrentUserOrder
                      ? "Pedidos en línea"
                      : "Pedidos solo con cuenta"}
                  </span>
                ) : null}
              </div>

              <h3 className="mt-4 font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight text-[#004e28] md:text-4xl">
                {
                  selectedMenu.name
                }
              </h3>

              {hasText(
                selectedMenu.description,
              ) ? (
                <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-gray-600 md:text-base">
                  {selectedMenu.description.trim()}
                </p>
              ) : null}

              {menuPrice ? (
                <p className="mt-4 text-xl font-black text-[#168e00]">
                  {menuPrice}
                </p>
              ) : null}

              {hasDates ||
              days?.length ||
              hasTimes ? (
                <dl className="mt-6 flex flex-wrap gap-2 text-xs text-gray-600 sm:text-sm">
                  {hasDates ? (
                    <div className="flex items-center gap-2 rounded-full bg-[#f2f3f4] px-3 py-2">
                      <dt className="sr-only">
                        Fechas
                      </dt>

                      <CalendarDays className="h-4 w-4 shrink-0 text-[#168e00]" />

                      <dd>
                        {hasText(
                          selectedMenu.date_start,
                        ) &&
                        hasText(
                          selectedMenu.date_end,
                        )
                          ? formatDateRange(
                              selectedMenu.date_start,
                              selectedMenu.date_end,
                            )
                          : hasText(
                                selectedMenu.date_start,
                              )
                            ? `Desde ${formatDate(
                                selectedMenu.date_start,
                              )}`
                            : `Hasta ${formatDate(
                                selectedMenu.date_end as string,
                              )}`}
                      </dd>
                    </div>
                  ) : null}

                  {days?.length ? (
                    <div className="flex items-center gap-2 rounded-full bg-[#f2f3f4] px-3 py-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-[#168e00]" />

                      <dd>
                        {days.join(
                          ", ",
                        )}
                      </dd>
                    </div>
                  ) : null}

                  {hasTimes ? (
                    <div className="flex items-center gap-2 rounded-full bg-[#f2f3f4] px-3 py-2">
                      <Clock3 className="h-4 w-4 shrink-0 text-[#168e00]" />

                      <dd>
                        {hasText(
                          selectedMenu.time_start,
                        ) &&
                        hasText(
                          selectedMenu.time_end,
                        )
                          ? `${formatTime(
                              selectedMenu.time_start,
                            )} – ${formatTime(
                              selectedMenu.time_end,
                            )}`
                          : hasText(
                                selectedMenu.time_start,
                              )
                            ? `Desde ${formatTime(
                                selectedMenu.time_start,
                              )}`
                            : `Hasta ${formatTime(
                                selectedMenu.time_end as string,
                              )}`}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {!settingsLoading &&
              acceptsOrders &&
              !canCurrentUserOrder ? (
                <div className="mt-5 rounded-2xl border border-[#004e28]/10 bg-[#004e28]/5 p-4">
                  <p className="text-sm font-bold text-[#004e28]">
                    Este negocio
                    recibe pedidos
                    de usuarios
                    registrados.
                  </p>

                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    Puedes
                    consultar todo
                    el menú. Para
                    agregar
                    productos y
                    realizar tu
                    pedido solo
                    necesitas
                    iniciar sesión.
                  </p>

                  <button
                    type="button"
                    onClick={
                      goToLoginForOrder
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#003b1f]"
                  >
                    <LogIn
                      size={16}
                    />
                    Iniciar sesión
                  </button>
                </div>
              ) : null}

              {!settingsLoading &&
              acceptsOrders &&
              canCurrentUserOrder &&
              !hasOrderableItems ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">
                    Los pedidos están activados, pero todavía no hay platillos con precio disponibles para agregar.
                  </p>
                </div>
              ) : null}

            </div>

            {cover ? (
              <button
                type="button"
                onClick={() =>
                  setLightboxImage(
                    {
                      src: cover,
                      alt: `Portada de ${selectedMenu.name}`,
                      name:
                        selectedMenu.name,
                      price:
                        menuPrice,
                      description:
                        hasText(
                          selectedMenu.description,
                        )
                          ? selectedMenu.description.trim()
                          : null,
                    },
                  )
                }
                className="relative min-h-56 cursor-zoom-in bg-[#e8eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#168e00] lg:min-h-72"
                aria-label={`Ampliar portada de ${selectedMenu.name}`}
              >
                <MenuImage
                  src={cover}
                  alt={`Portada de ${selectedMenu.name}`}
                  sizes="(max-width: 1023px) calc(100vw - 32px), 352px"
                />
              </button>
            ) : null}
          </div>
        </article>

        <div className="mt-10 space-y-10">
          {selectedMenu.sections.map(
            (section) => (
              <section
                key={
                  section.id
                }
                aria-labelledby={`menu-section-${section.id}`}
                className="border-t border-[#004e28]/10 pt-7 first:border-0 first:pt-0"
              >
                <header className="mb-4 max-w-3xl">
                  <h3
                    id={`menu-section-${section.id}`}
                    className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]"
                  >
                    {
                      section.name
                    }
                  </h3>

                  {hasText(
                    section.description,
                  ) ? (
                    <p className="mt-1.5 text-sm leading-6 text-gray-600">
                      {section.description.trim()}
                    </p>
                  ) : null}
                </header>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {section.items.map(
                    (item) => (
                      <MenuItemCard
                        key={
                          item.id
                        }
                        item={
                          item
                        }
                        quantity={
                          cart[
                            item
                              .id
                          ]
                            ?.quantity ||
                          0
                        }
                        canOrder={
                          canCurrentUserOrder &&
                          item.is_available &&
                          typeof item.price ===
                            "number" &&
                          Number.isFinite(
                            item.price,
                          )
                        }
                        onOpenImage={
                          setLightboxImage
                        }
                        onAdd={() =>
                          changeQuantity(
                            item,
                            1,
                          )
                        }
                        onDecrease={() =>
                          changeQuantity(
                            item,
                            -1,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      </div>

      {cartOpen ? (
        <div
          className="fixed inset-0 z-[21000] flex justify-end bg-black/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tu pedido"
          onClick={() =>
            setCartOpen(
              false,
            )
          }
        >
          <div
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                  Tu pedido
                </p>

                <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-black text-[#004e28]">
                  {
                    selectedMenu.name
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCartOpen(
                    false,
                  )
                }
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Cerrar pedido"
              >
                <X
                  size={20}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cartItems.length ===
              0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
                    <ShoppingBag
                      size={30}
                    />
                  </div>

                  <h4 className="mt-4 text-lg font-bold text-gray-900">
                    Tu pedido
                    está vacío
                  </h4>

                  <p className="mt-1 max-w-xs text-sm text-gray-500">
                    Agrega
                    productos del
                    menú para
                    continuar.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map(
                    (
                      line,
                    ) => (
                      <div
                        key={
                          line
                            .item
                            .id
                        }
                        className="rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#004e28]">
                              {
                                line
                                  .item
                                  .name
                              }
                            </p>

                            <p className="mt-0.5 text-sm font-black text-[#168e00]">
                              {currencyFormatter.format(
                                Number(
                                  line
                                    .item
                                    .price ||
                                    0,
                                ) *
                                  line.quantity,
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeLine(
                                line
                                  .item
                                  .id,
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            aria-label={`Eliminar ${line.item.name}`}
                          >
                            <Trash2
                              size={
                                17
                              }
                            />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-xl border border-gray-200 p-1">
                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(
                                  line.item,
                                  -1,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-50"
                            >
                              <Minus
                                size={
                                  15
                                }
                              />
                            </button>

                            <span className="min-w-8 text-center text-sm font-bold">
                              {
                                line.quantity
                              }
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(
                                  line.item,
                                  1,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#168e00] text-white"
                            >
                              <Plus
                                size={
                                  15
                                }
                              />
                            </button>
                          </div>

                          <span className="text-xs text-gray-400">
                            Máximo 99
                          </span>
                        </div>

                        <label className="mt-3 block text-xs font-bold text-gray-500">
                          Nota para
                          este
                          producto

                          <textarea
                            value={
                              line.notes
                            }
                            maxLength={
                              500
                            }
                            onChange={(
                              event,
                            ) =>
                              updateLineNotes(
                                line
                                  .item
                                  .id,
                                event
                                  .target
                                  .value,
                              )
                            }
                            placeholder="Ej. sin cebolla, salsa aparte..."
                            className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-800 outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                          />
                        </label>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-500">
                  Subtotal
                  estimado
                </span>

                <span className="text-xl font-black text-[#004e28]">
                  {currencyFormatter.format(
                    cartSubtotal,
                  )}
                </span>
              </div>

              <p className="mb-4 text-xs leading-5 text-gray-400">
                El total
                definitivo se
                vuelve a calcular
                en el servidor
                usando los
                precios
                vigentes.
              </p>

              <button
                type="button"
                disabled={
                  !cartItems.length
                }
                onClick={
                  openCheckout
                }
                className="w-full rounded-xl bg-[#168e00] px-4 py-3.5 font-bold text-white hover:bg-[#117500] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar con el
                pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div
          className="fixed inset-0 z-[22000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Finalizar pedido"
          onClick={() =>
            !submitting &&
            setCheckoutOpen(
              false,
            )
          }
        >
          <form
            onSubmit={
              submitOrder
            }
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                  Finalizar
                  pedido
                </p>

                <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-black text-[#004e28]">
                  Tus datos
                </h3>
              </div>

              <button
                type="button"
                disabled={
                  submitting
                }
                onClick={() =>
                  setCheckoutOpen(
                    false,
                  )
                }
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                aria-label="Cerrar"
              >
                <X
                  size={20}
                />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {checkoutError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {
                    checkoutError
                  }
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-gray-700 sm:col-span-2">
                  Nombre

                  <input
                    value={
                      customerName
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomerName(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                    minLength={
                      2
                    }
                    maxLength={
                      255
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                </label>

                <label className="text-sm font-bold text-gray-700">
                  Correo

                  <input
                    type="email"
                    value={
                      customerEmail
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomerEmail(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                </label>

                <label className="text-sm font-bold text-gray-700">
                  Teléfono

                  <input
                    type="tel"
                    value={
                      customerPhone
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomerPhone(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                    minLength={
                      7
                    }
                    maxLength={
                      40
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-gray-700">
                  ¿Cómo quieres
                  recibirlo?
                </legend>

                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {orderSettings?.allows_pickup ? (
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                        fulfillmentType ===
                        "pickup"
                          ? "border-[#168e00] bg-[#168e00]/5"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fulfillment"
                        value="pickup"
                        checked={
                          fulfillmentType ===
                          "pickup"
                        }
                        onChange={() =>
                          setFulfillmentType(
                            "pickup",
                          )
                        }
                        className="accent-[#168e00]"
                      />

                      <Store
                        className="text-[#168e00]"
                        size={
                          21
                        }
                      />

                      <span>
                        <strong className="block text-sm text-gray-900">
                          Recoger
                        </strong>

                        <span className="text-xs text-gray-500">
                          En el
                          establecimiento
                        </span>
                      </span>
                    </label>
                  ) : null}

                  {orderSettings?.allows_delivery ? (
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                        fulfillmentType ===
                        "delivery"
                          ? "border-[#168e00] bg-[#168e00]/5"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fulfillment"
                        value="delivery"
                        checked={
                          fulfillmentType ===
                          "delivery"
                        }
                        onChange={() =>
                          setFulfillmentType(
                            "delivery",
                          )
                        }
                        className="accent-[#168e00]"
                      />

                      <Truck
                        className="text-[#168e00]"
                        size={
                          21
                        }
                      />

                      <span>
                        <strong className="block text-sm text-gray-900">
                          Domicilio
                        </strong>

                        <span className="text-xs text-gray-500">
                          Entrega
                          por el
                          negocio
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </fieldset>

              {fulfillmentType ===
              "delivery" ? (
                <label className="block text-sm font-bold text-gray-700">
                  Dirección de
                  entrega

                  <textarea
                    value={
                      deliveryAddress
                    }
                    onChange={(
                      event,
                    ) =>
                      setDeliveryAddress(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                    maxLength={
                      1500
                    }
                    placeholder="Calle, número, colonia, referencias..."
                    className="mt-1.5 min-h-24 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                </label>
              ) : null}

              <label className="block text-sm font-bold text-gray-700">
                Notas generales{" "}

                <span className="font-normal text-gray-400">
                  (opcional)
                </span>

                <textarea
                  value={
                    generalNotes
                  }
                  onChange={(
                    event,
                  ) =>
                    setGeneralNotes(
                      event
                        .target
                        .value,
                    )
                  }
                  maxLength={
                    1500
                  }
                  placeholder="Cualquier indicación general para el negocio"
                  className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                />
              </label>

              <div className="rounded-2xl bg-[#f2f3f4] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Productos
                  </span>

                  <strong>
                    {
                      cartQuantity
                    }
                  </strong>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-[#004e28]">
                    Total estimado
                  </span>

                  <strong className="text-xl text-[#168e00]">
                    {currencyFormatter.format(
                      cartSubtotal,
                    )}
                  </strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3.5 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Check
                    size={18}
                  />
                )}

                {submitting
                  ? "Creando pedido..."
                  : "Confirmar pedido"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[23000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Compartir menú"
          onClick={() =>
            setShareOpen(
              false,
            )
          }
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                  Compartir
                </p>

                <h3 className="mt-1 text-xl font-black text-[#004e28]">
                  {
                    selectedMenu.name
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShareOpen(
                    false,
                  )
                }
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X
                  size={20}
                />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://wa.me/?text=${encodeURIComponent(
                      `${shareText} ${shareUrl()}`,
                    )}`,
                  )
                }
                className="rounded-2xl border border-gray-200 p-4 text-left hover:bg-gray-50"
              >
                <span className="font-bold text-gray-900">
                  WhatsApp
                </span>

                <span className="mt-1 block text-xs text-gray-500">
                  Enviar por
                  chat
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      shareUrl(),
                    )}`,
                  )
                }
                className="rounded-2xl border border-gray-200 p-4 text-left hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <Facebook
                    size={
                      17
                    }
                  />
                  Facebook
                </span>

                <span className="mt-1 block text-xs text-gray-500">
                  Compartir
                  enlace
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      shareText,
                    )}&url=${encodeURIComponent(
                      shareUrl(),
                    )}`,
                  )
                }
                className="rounded-2xl border border-gray-200 p-4 text-left hover:bg-gray-50"
              >
                <span className="font-bold text-gray-900">
                  X
                </span>

                <span className="mt-1 block text-xs text-gray-500">
                  Publicar
                  enlace
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://t.me/share/url?url=${encodeURIComponent(
                      shareUrl(),
                    )}&text=${encodeURIComponent(
                      shareText,
                    )}`,
                  )
                }
                className="rounded-2xl border border-gray-200 p-4 text-left hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <Send
                    size={
                      17
                    }
                  />
                  Telegram
                </span>

                <span className="mt-1 block text-xs text-gray-500">
                  Enviar
                  enlace
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                void copyShareUrl()
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-[#004e28] hover:bg-gray-50"
            >
              {copied ? (
                <Check
                  size={17}
                />
              ) : (
                <Copy
                  size={17}
                />
              )}

              {copied
                ? "Enlace copiado"
                : "Copiar enlace"}
            </button>

            <button
              type="button"
              onClick={() =>
                void nativeShare()
              }
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white hover:bg-[#117500]"
            >
              <Share2
                size={17}
              />
              Más opciones
            </button>
          </div>
        </div>
      ) : null}

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-[24000] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-5 lg:p-7"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen ampliada: ${lightboxImage.alt}`}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative grid max-h-[94vh] w-[94vw] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#08110c] shadow-2xl lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.65fr)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/80 sm:right-4 sm:top-4"
              aria-label="Cerrar imagen ampliada"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative h-[52vh] min-h-[300px] w-full bg-black sm:h-[60vh] lg:h-[88vh]">
              <MenuImage src={lightboxImage.src} alt={lightboxImage.alt} sizes="(max-width: 1023px) 94vw, 70vw" fit="contain" />
            </div>

            <aside className="max-h-[42vh] overflow-y-auto border-t border-white/10 bg-gradient-to-b from-[#102219] to-[#08110c] px-5 py-5 text-white sm:px-7 sm:py-6 lg:max-h-[88vh] lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
              <div className="pr-10 lg:pr-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#7cde68]">Detalle del platillo</p>
                <h3 className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl font-black leading-tight sm:text-3xl">{lightboxImage.name}</h3>
                {lightboxImage.price ? (
                  <p className="mt-3 text-xl font-black text-[#7cde68] sm:text-2xl">{lightboxImage.price}</p>
                ) : null}
              </div>

              {lightboxImage.description ? (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">Descripción</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/80 sm:text-base">{lightboxImage.description}</p>
                </div>
              ) : (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-sm text-white/45">Este platillo no tiene descripción adicional.</p>
                </div>
              )}

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs leading-5 text-white/45">La fotografía se muestra completa, sin recortes. Puedes desplazarte en esta información si la descripción es larga.</p>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}