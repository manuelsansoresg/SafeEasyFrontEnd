"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  LogIn,
  Maximize2,
  Minus,
  Plus,
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
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { menuOrderService } from "@/services/menuOrderService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  Menu,
  MenuDay,
  MenuItem,
  MenuItemVariant,
} from "@/types/menu";
import type {
  MenuOrderFulfillmentType,
  MenuOrderPaymentMethod,
  MenuOrderSettings,
} from "@/types/menuOrder";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
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

function createRequestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `menu-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function formatMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? currencyFormatter.format(value)
    : null;
}

function formatTime(value: string) {
  const [hoursValue, minutesValue = "00"] = value.split(":");
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours)) return value;
  const period = hours >= 12 ? "p.m." : "a.m.";
  return `${hours % 12 || 12}:${minutesValue.padStart(2, "0")} ${period}`;
}

function menuSchedule(menu: Menu) {
  const parts: string[] = [];

  if (menu.days_of_week?.length) {
    parts.push(
      [...menu.days_of_week]
        .sort((a, b) => a - b)
        .map((day) => dayNames[day])
        .join(", "),
    );
  }

  if (menu.date_start || menu.date_end) {
    parts.push(
      [menu.date_start, menu.date_end]
        .filter(Boolean)
        .join(" → "),
    );
  }

  if (menu.time_start || menu.time_end) {
    parts.push(
      [menu.time_start, menu.time_end]
        .filter((value): value is string => Boolean(value))
        .map(formatTime)
        .join(" – "),
    );
  }

  return parts.join(" · ");
}

type CartLine = {
  item: MenuItem;
  variant: MenuItemVariant | null;
  quantity: number;
  notes: string;
};

function lineKey(itemId: number, variantId?: number | null) {
  return `${itemId}:${variantId ?? "base"}`;
}

function itemHasVariants(item: MenuItem) {
  return Array.isArray(item.variants) && item.variants.length > 0;
}

function availableVariants(item: MenuItem) {
  return [...(item.variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.id - b.id,
    );
}

function MenuItemCard({
  item,
  cart,
  canOrder,
  changeQuantity,
  onOpen,
}: {
  item: MenuItem;
  cart: Record<string, CartLine>;
  canOrder: boolean;
  changeQuantity: (
    item: MenuItem,
    delta: number,
    variant?: MenuItemVariant | null,
  ) => void;
  onOpen: (item: MenuItem) => void;
}) {
  const variants = availableVariants(item);
  const image = item.image_thumbnail_url || item.image_url;
  const baseQuantity = cart[lineKey(item.id)]?.quantity || 0;

  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        item.is_available
          ? "border-[#004e28]/10"
          : "border-gray-200 opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group relative aspect-[4/3] w-full overflow-hidden bg-[#edf3ee] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#168e00]"
        aria-label={`Ver información completa de ${item.name}`}
      >
        {image ? (
          <Image
            src={image}
            alt={item.name}
            fill
            unoptimized
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#004e28]/30">
            <UtensilsCrossed size={34} />
          </div>
        )}

        <span className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-xl bg-[#004e28]/90 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg backdrop-blur-sm transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <Maximize2 size={14} /> Ver detalle
        </span>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="min-w-0 flex-1 text-left font-[family-name:var(--font-varela-round)] text-base font-black leading-snug text-[#004e28] hover:text-[#168e00] focus-visible:outline-none focus-visible:underline"
          >
            {item.name}
          </button>
          {!item.is_available ? (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">
              Agotado
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="mt-1 line-clamp-4 text-sm leading-5 text-gray-500">
            {item.description}
          </p>
        ) : null}

        {item.label ? (
          <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            {item.label}
          </span>
        ) : null}

        {variants.length ? (
          <div className="mt-4 space-y-2">
            {variants.map((variant) => {
              const quantity = cart[lineKey(item.id, variant.id)]?.quantity || 0;
              const enabled =
                canOrder &&
                item.is_available &&
                variant.is_available &&
                Number.isFinite(variant.price);

              return (
                <div
                  key={variant.id}
                  className={`rounded-xl border p-3 ${
                    variant.is_available
                      ? "border-gray-200"
                      : "border-gray-100 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold leading-5 text-gray-800">
                        {variant.name}
                      </p>
                      <p className="text-sm font-black text-[#168e00]">
                        {formatMoney(variant.price)}
                      </p>
                    </div>

                    {enabled ? (
                      quantity > 0 ? (
                        <div className="flex items-center rounded-xl border border-[#168e00]/20 bg-[#168e00]/5 p-1">
                          <button
                            type="button"
                            onClick={() => changeQuantity(item, -1, variant)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#004e28] hover:bg-white"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-7 text-center text-sm font-black text-[#004e28]">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(item, 1, variant)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#168e00] text-white"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeQuantity(item, 1, variant)}
                          className="rounded-xl bg-[#168e00] px-3 py-2 text-xs font-bold text-white"
                        >
                          Agregar
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">
                        No disponible
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-base font-black text-[#168e00]">
              {formatMoney(item.price) || "Sin precio"}
            </p>

            {canOrder && item.is_available && typeof item.price === "number" ? (
              baseQuantity > 0 ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-[#168e00]/20 bg-[#168e00]/5 p-1">
                  <button
                    type="button"
                    onClick={() => changeQuantity(item, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#004e28] hover:bg-white"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-black text-[#004e28]">
                    {baseQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#168e00] text-white"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => changeQuantity(item, 1)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#168e00] px-3 py-2.5 text-xs font-bold text-white"
                >
                  <Plus size={15} /> Agregar
                </button>
              )
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

function MenuItemDetailModal({
  item,
  cart,
  canOrder,
  changeQuantity,
  onClose,
}: {
  item: MenuItem;
  cart: Record<string, CartLine>;
  canOrder: boolean;
  changeQuantity: (
    item: MenuItem,
    delta: number,
    variant?: MenuItemVariant | null,
  ) => void;
  onClose: () => void;
}) {
  const variants = availableVariants(item);
  const image = item.image_url || item.image_thumbnail_url;
  const baseQuantity = cart[lineKey(item.id)]?.quantity || 0;
  const basePrice = formatMoney(item.price);
  const showBaseOldPrice =
    typeof item.old_price === "number" &&
    typeof item.price === "number" &&
    item.old_price > item.price;

  return (
    <div
      className="fixed inset-0 z-[20500] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`menu-item-detail-${item.id}`}
      onClick={onClose}
    >
      <article
        className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#004e28] shadow-lg backdrop-blur hover:bg-white"
          aria-label="Cerrar detalle del platillo"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative min-h-64 overflow-hidden bg-[#edf3ee] md:min-h-[560px]">
            {image ? (
              <Image
                src={image}
                alt={item.name}
                fill
                unoptimized
                sizes="(max-width: 767px) 100vw, 45vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center text-[#004e28]/25">
                <UtensilsCrossed size={64} strokeWidth={1.4} />
              </div>
            )}

            {!item.is_available ? (
              <span className="absolute bottom-4 left-4 rounded-full bg-gray-900/85 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
                Agotado
              </span>
            ) : null}
          </div>

          <div className="p-5 sm:p-7 md:p-8">
            {item.label ? (
              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                {item.label}
              </span>
            ) : null}

            <h3
              id={`menu-item-detail-${item.id}`}
              className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight text-[#004e28]"
            >
              {item.name}
            </h3>

            {hasText(item.description) ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600 sm:text-base">
                {item.description}
              </p>
            ) : null}

            {variants.length ? (
              <div className="mt-7">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#168e00]">
                  Elige una presentación
                </p>
                <div className="space-y-3">
                  {variants.map((variant) => {
                    const quantity =
                      cart[lineKey(item.id, variant.id)]?.quantity || 0;
                    const enabled =
                      canOrder &&
                      item.is_available &&
                      variant.is_available &&
                      Number.isFinite(variant.price);
                    const showOldPrice =
                      typeof variant.old_price === "number" &&
                      variant.old_price > variant.price;

                    return (
                      <div
                        key={variant.id}
                        className={`rounded-2xl border p-4 ${
                          variant.is_available
                            ? "border-[#004e28]/10 bg-[#f7f9f8]"
                            : "border-gray-100 bg-gray-50 opacity-65"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold leading-6 text-gray-900">
                              {variant.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline gap-2">
                              <span className="text-lg font-black text-[#168e00]">
                                {formatMoney(variant.price)}
                              </span>
                              {showOldPrice ? (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatMoney(variant.old_price)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {enabled ? (
                            quantity > 0 ? (
                              <div className="flex items-center justify-between rounded-xl border border-[#168e00]/20 bg-white p-1 sm:min-w-32">
                                <button type="button" onClick={() => changeQuantity(item, -1, variant)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#004e28] hover:bg-[#f2f3f4]" aria-label={`Quitar ${variant.name}`}>
                                  <Minus size={16} />
                                </button>
                                <span className="min-w-8 text-center text-sm font-black text-[#004e28]">{quantity}</span>
                                <button type="button" onClick={() => changeQuantity(item, 1, variant)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#168e00] text-white" aria-label={`Agregar ${variant.name}`}>
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => changeQuantity(item, 1, variant)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white">
                                <Plus size={16} /> Agregar
                              </button>
                            )
                          ) : (
                            <span className="w-fit rounded-full bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500">
                              No disponible
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-7 border-t border-gray-100 pt-5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-black text-[#168e00]">
                    {basePrice || "Sin precio"}
                  </span>
                  {showBaseOldPrice ? (
                    <span className="text-sm text-gray-400 line-through">
                      {formatMoney(item.old_price)}
                    </span>
                  ) : null}
                </div>

                {canOrder && item.is_available && typeof item.price === "number" ? (
                  baseQuantity > 0 ? (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-[#168e00]/20 bg-[#168e00]/5 p-1">
                      <button type="button" onClick={() => changeQuantity(item, -1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#004e28] hover:bg-white" aria-label={`Quitar ${item.name}`}>
                        <Minus size={17} />
                      </button>
                      <span className="min-w-10 text-center font-black text-[#004e28]">{baseQuantity}</span>
                      <button type="button" onClick={() => changeQuantity(item, 1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#168e00] text-white" aria-label={`Agregar ${item.name}`}>
                        <Plus size={17} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => changeQuantity(item, 1)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-bold text-white">
                      <Plus size={17} /> Agregar al pedido
                    </button>
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export function PublicSupplierMenu({ menus }: { menus: Menu[] }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const supplierSlug = String(params?.slug || "");

  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(
    menus[0]?.id ?? null,
  );
  const [settingsByMenu, setSettingsByMenu] = useState<
    Record<number, MenuOrderSettings>
  >({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState(createRequestId);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] =
    useState<MenuOrderFulfillmentType>("pickup");
  const [paymentMethod, setPaymentMethod] =
    useState<MenuOrderPaymentMethod>("cash");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  const selectedMenu =
    menus.find((menu) => menu.id === selectedMenuId) ?? menus[0];
  const orderSettings = selectedMenu
    ? settingsByMenu[selectedMenu.id] ?? null
    : null;

  useEffect(() => {
    if (!detailItem) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailItem(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailItem]);

  useEffect(() => {
    if (!user) return;
    setCustomerName((current) => current || user.name || "");
    setCustomerEmail((current) => current || user.email || "");
  }, [user]);

  useEffect(() => {
    if (!supplierSlug || menus.length === 0) return;

    const controller = new AbortController();
    setSettingsLoading(true);

    Promise.all(
      menus.map(async (menu) => {
        try {
          const settings = await menuOrderService.publicSettings(
            supplierSlug,
            menu.id,
            controller.signal,
          );
          return [menu.id, settings] as const;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }
          return [
            menu.id,
            {
              menu_id: menu.id,
              supplier_id: menu.supplier_id,
              accepts_orders: false,
              allows_pickup: true,
              allows_delivery: false,
              allow_guest_orders: true,
              allows_cash: true,
              allows_online_payment: false,
              mercadopago_linked: false,
              online_payment_available: false,
            } satisfies MenuOrderSettings,
          ] as const;
        }
      }),
    )
      .then((entries) => {
        if (!controller.signal.aborted) {
          setSettingsByMenu(Object.fromEntries(entries));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettingsLoading(false);
      });

    return () => controller.abort();
  }, [menus, supplierSlug]);

  useEffect(() => {
    setCart({});
    setCartOpen(false);
    setCheckoutOpen(false);
  }, [selectedMenu?.id]);

  useEffect(() => {
    if (!orderSettings) return;

    if (orderSettings.allows_pickup) setFulfillmentType("pickup");
    else if (orderSettings.allows_delivery) setFulfillmentType("delivery");

    if (orderSettings.allows_cash) setPaymentMethod("cash");
    else if (orderSettings.online_payment_available) setPaymentMethod("online");
  }, [orderSettings]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartQuantity = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.quantity, 0),
    [cartItems],
  );
  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, line) =>
          sum +
          Number(line.variant?.price ?? line.item.price ?? 0) *
            line.quantity,
        0,
      ),
    [cartItems],
  );

  if (!selectedMenu) return null;

  const acceptsOrders = Boolean(orderSettings?.accepts_orders);
  const canCurrentUserOrder =
    acceptsOrders &&
    (isAuthenticated || Boolean(orderSettings?.allow_guest_orders));

  const hasOrderableItems = selectedMenu.sections.some((section) =>
    section.items.some((item) => {
      if (!item.is_available) return false;
      if (itemHasVariants(item)) {
        return availableVariants(item).some(
          (variant) =>
            variant.is_available && Number.isFinite(variant.price),
        );
      }
      return typeof item.price === "number" && Number.isFinite(item.price);
    }),
  );

  const schedule = menuSchedule(selectedMenu);
  const cover = selectedMenu.image_url || selectedMenu.image_thumbnail_url;

  function goToLoginForOrder() {
    router.push(getLoginUrl(getBrowserPathWithSearchAndHash()));
  }

  function changeQuantity(
    item: MenuItem,
    delta: number,
    variant: MenuItemVariant | null = null,
  ) {
    if (!item.is_available) return;
    if (itemHasVariants(item) && !variant) return;
    if (
      variant &&
      (!variant.is_active ||
        !variant.is_available ||
        !Number.isFinite(variant.price))
    ) {
      return;
    }
    if (
      !variant &&
      (typeof item.price !== "number" || !Number.isFinite(item.price))
    ) {
      return;
    }

    const key = lineKey(item.id, variant?.id);
    setCart((current) => {
      const existing = current[key];
      const quantity = Math.max(
        0,
        Math.min(99, (existing?.quantity || 0) + delta),
      );
      const next = { ...current };

      if (quantity === 0) delete next[key];
      else {
        next[key] = {
          item,
          variant,
          quantity,
          notes: existing?.notes || "",
        };
      }
      return next;
    });
  }

  function updateNotes(key: string, notes: string) {
    setCart((current) => {
      const line = current[key];
      if (!line) return current;
      return { ...current, [key]: { ...line, notes } };
    });
  }

  function removeLine(key: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function openCheckout() {
    if (!cartItems.length || !orderSettings?.accepts_orders) return;

    if (!isAuthenticated && !orderSettings.allow_guest_orders) {
      goToLoginForOrder();
      return;
    }

    setCheckoutError(null);
    setClientRequestId(createRequestId());

    if (orderSettings.allows_pickup) setFulfillmentType("pickup");
    else if (orderSettings.allows_delivery) setFulfillmentType("delivery");

    if (orderSettings.allows_cash) setPaymentMethod("cash");
    else if (orderSettings.online_payment_available) setPaymentMethod("online");

    setCartOpen(false);
    setCheckoutOpen(true);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orderSettings?.accepts_orders || !supplierSlug || !cartItems.length) {
      return;
    }

    if (!isAuthenticated && !orderSettings.allow_guest_orders) {
      goToLoginForOrder();
      return;
    }

    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setCheckoutError("Completa tu nombre, correo y teléfono.");
      return;
    }

    if (fulfillmentType === "delivery" && !deliveryAddress.trim()) {
      setCheckoutError("Escribe la dirección para la entrega.");
      return;
    }

    if (paymentMethod === "cash" && !orderSettings.allows_cash) {
      setCheckoutError("El pago en efectivo ya no está disponible.");
      return;
    }

    if (
      paymentMethod === "online" &&
      !orderSettings.online_payment_available
    ) {
      setCheckoutError("El pago en línea ya no está disponible.");
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);

    try {
      const order = await menuOrderService.createPublic(supplierSlug, {
        menu_id: selectedMenu.id,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
        fulfillment_type: fulfillmentType,
        payment_method: paymentMethod,
        delivery_address:
          fulfillmentType === "delivery" ? deliveryAddress.trim() : null,
        notes: generalNotes.trim() || null,
        client_request_id: clientRequestId,
        items: cartItems.map((line) => ({
          menu_item_id: line.item.id,
          ...(line.variant ? { variant_id: line.variant.id } : {}),
          quantity: line.quantity,
          notes: line.notes.trim() || null,
        })),
      });

      try {
        window.localStorage.setItem(
          `menu-order-token:${order.order_number}`,
          order.management_token,
        );
      } catch {
        // El usuario registrado también puede recuperar el pedido desde /mine.
      }

      setCheckoutOpen(false);
      setCart({});

      if (order.payment_method === "online") {
        const safeCheckout = getSafeMercadoPagoUrl(order.payment_checkout_url);
        if (!safeCheckout) {
          router.push(
            `/pedidos/menu/${encodeURIComponent(order.order_number)}?management_token=${encodeURIComponent(order.management_token)}`,
          );
          return;
        }

        window.location.assign(safeCheckout);
        return;
      }

      router.push(
        `/pedidos/menu/${encodeURIComponent(order.order_number)}?management_token=${encodeURIComponent(order.management_token)}`,
      );
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "No se pudo crear el pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function shareMenu() {
    const url = new URL(window.location.href);
    url.searchParams.set("menu", String(selectedMenu.id));
    url.hash = "menu";

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedMenu.name,
          text: `Mira el menú ${selectedMenu.name}`,
          url: url.toString(),
        });
      } else {
        await navigator.clipboard.writeText(url.toString());
      }
    } catch {
      // Cancelar compartir no necesita mostrar error.
    }
  }

  return (
    <section id="menu" className="bg-[#f7f9f8] py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#168e00]">Menú</p>
            <h2 className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28]">
              {selectedMenu.name}
            </h2>
            {selectedMenu.description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                {selectedMenu.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void shareMenu()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-[#004e28] shadow-sm"
            >
              <Share2 size={16} /> Compartir
            </button>

            {acceptsOrders && hasOrderableItems ? (
              !isAuthenticated && !orderSettings?.allow_guest_orders ? (
                <button
                  type="button"
                  onClick={goToLoginForOrder}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white"
                >
                  <LogIn size={16} /> Iniciar sesión para pedir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white"
                >
                  <ShoppingBag size={16} /> Pedido ({cartQuantity})
                </button>
              )
            ) : null}
          </div>
        </div>

        {menus.length > 1 ? (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {menus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() => {
                  setSelectedMenuId(menu.id);
                  setDetailItem(null);
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  menu.id === selectedMenu.id
                    ? "bg-[#004e28] text-white"
                    : "bg-white text-gray-600 shadow-sm"
                }`}
              >
                {menu.name}
              </button>
            ))}
          </div>
        ) : null}

        <article className="mb-8 overflow-hidden rounded-3xl border border-[#004e28]/10 bg-white shadow-sm">
          <div className="grid md:grid-cols-[320px_1fr]">
            {cover ? (
              <div className="relative min-h-52 bg-[#e8eee9] md:min-h-64">
                <Image
                  src={cover}
                  alt={`Portada de ${selectedMenu.name}`}
                  fill
                  unoptimized
                  sizes="(max-width: 767px) 100vw, 320px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center bg-gradient-to-br from-[#004e28] to-[#168e00] text-white md:min-h-64">
                <UtensilsCrossed size={58} strokeWidth={1.4} />
              </div>
            )}

            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap gap-2">
                {schedule ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#004e28]/[0.06] px-3 py-1.5 text-xs font-bold text-[#004e28]">
                    <CalendarDays size={14} /> {schedule}
                  </span>
                ) : null}
                {settingsLoading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-500">
                    <Loader2 size={13} className="animate-spin" /> Consultando pedidos
                  </span>
                ) : acceptsOrders ? (
                  <span className="rounded-full bg-[#168e00]/10 px-3 py-1.5 text-xs font-bold text-[#0b6d00]">Acepta pedidos</span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {orderSettings?.allows_pickup ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <Store size={20} className="text-[#168e00]" />
                    <p className="mt-2 text-sm font-bold text-gray-900">Recoger</p>
                  </div>
                ) : null}
                {orderSettings?.allows_delivery ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <Truck size={20} className="text-[#168e00]" />
                    <p className="mt-2 text-sm font-bold text-gray-900">Domicilio</p>
                  </div>
                ) : null}
                {orderSettings?.allows_cash ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <Banknote size={20} className="text-[#168e00]" />
                    <p className="mt-2 text-sm font-bold text-gray-900">Efectivo</p>
                  </div>
                ) : null}
                {orderSettings?.online_payment_available ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <CreditCard size={20} className="text-[#168e00]" />
                    <p className="mt-2 text-sm font-bold text-gray-900">Tarjeta</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-9">
          {selectedMenu.sections.map((section) => (
            <section key={section.id}>
              <header className="mb-4">
                <h3 className="font-[family-name:var(--font-varela-round)] text-2xl font-black text-[#004e28]">
                  {section.name}
                </h3>
                {section.description ? (
                  <p className="mt-1 text-sm text-gray-500">{section.description}</p>
                ) : null}
              </header>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    cart={cart}
                    canOrder={canCurrentUserOrder}
                    changeQuantity={changeQuantity}
                    onOpen={setDetailItem}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {detailItem ? (
        <MenuItemDetailModal
          item={detailItem}
          cart={cart}
          canOrder={canCurrentUserOrder}
          changeQuantity={changeQuantity}
          onClose={() => setDetailItem(null)}
        />
      ) : null}

      {acceptsOrders && hasOrderableItems && cartQuantity > 0 && !cartOpen && !checkoutOpen ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 right-5 z-[19000] inline-flex items-center gap-3 rounded-2xl bg-[#004e28] px-5 py-3.5 font-bold text-white shadow-2xl"
        >
          <ShoppingBag size={20} />
          <span>{cartQuantity} productos</span>
          <span className="text-white/70">{currencyFormatter.format(cartSubtotal)}</span>
        </button>
      ) : null}

      {cartOpen ? (
        <div
          className="fixed inset-0 z-[21000] flex justify-end bg-black/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tu pedido"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">Tu pedido</p>
                <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-black text-[#004e28]">{selectedMenu.name}</h3>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Cerrar pedido">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cartItems.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <ShoppingBag size={40} className="text-[#168e00]" />
                  <h4 className="mt-4 text-lg font-bold text-gray-900">Tu pedido está vacío</h4>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((line) => {
                    const key = lineKey(line.item.id, line.variant?.id);
                    return (
                      <div key={key} className="rounded-2xl border border-gray-100 p-4">
                        <div className="flex gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#004e28]">{line.item.name}</p>
                            {line.variant ? <p className="text-xs font-semibold text-gray-500">{line.variant.name}</p> : null}
                            <p className="mt-1 text-sm font-black text-[#168e00]">
                              {currencyFormatter.format(Number(line.variant?.price ?? line.item.price ?? 0) * line.quantity)}
                            </p>
                          </div>
                          <button type="button" onClick={() => removeLine(key)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Eliminar ${line.item.name}`}>
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-xl border border-gray-200 p-1">
                            <button type="button" onClick={() => changeQuantity(line.item, -1, line.variant)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-50">
                              <Minus size={15} />
                            </button>
                            <span className="min-w-8 text-center text-sm font-bold">{line.quantity}</span>
                            <button type="button" onClick={() => changeQuantity(line.item, 1, line.variant)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#168e00] text-white">
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>

                        <label className="mt-3 block text-xs font-bold text-gray-500">
                          Nota para este producto
                          <textarea
                            value={line.notes}
                            maxLength={500}
                            onChange={(event) => updateNotes(key, event.target.value)}
                            placeholder="Ej. sin cebolla, salsa aparte..."
                            className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-800 outline-none focus:border-[#168e00]"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-500">Subtotal estimado</span>
                <span className="text-xl font-black text-[#004e28]">{currencyFormatter.format(cartSubtotal)}</span>
              </div>
              <button
                type="button"
                disabled={!cartItems.length}
                onClick={openCheckout}
                className="w-full rounded-xl bg-[#168e00] px-4 py-3.5 font-bold text-white disabled:opacity-40"
              >
                Continuar con el pedido
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
          onClick={() => !submitting && setCheckoutOpen(false)}
        >
          <form
            onSubmit={submitOrder}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">Finalizar pedido</p>
                <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-black text-[#004e28]">Tus datos</h3>
              </div>
              <button type="button" disabled={submitting} onClick={() => setCheckoutOpen(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {checkoutError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{checkoutError}</div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-gray-700 sm:col-span-2">
                  Nombre
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required minLength={2} maxLength={255} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00]" />
                </label>
                <label className="text-sm font-bold text-gray-700">
                  Correo
                  <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00]" />
                </label>
                <label className="text-sm font-bold text-gray-700">
                  Teléfono
                  <input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required minLength={7} maxLength={40} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00]" />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-gray-700">¿Cómo quieres recibirlo?</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {orderSettings?.allows_pickup ? (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${fulfillmentType === "pickup" ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                      <input type="radio" name="fulfillment" value="pickup" checked={fulfillmentType === "pickup"} onChange={() => setFulfillmentType("pickup")} className="accent-[#168e00]" />
                      <Store className="text-[#168e00]" size={21} />
                      <span><strong className="block text-sm text-gray-900">Recoger</strong><span className="text-xs text-gray-500">En el establecimiento</span></span>
                    </label>
                  ) : null}
                  {orderSettings?.allows_delivery ? (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${fulfillmentType === "delivery" ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                      <input type="radio" name="fulfillment" value="delivery" checked={fulfillmentType === "delivery"} onChange={() => setFulfillmentType("delivery")} className="accent-[#168e00]" />
                      <Truck className="text-[#168e00]" size={21} />
                      <span><strong className="block text-sm text-gray-900">Domicilio</strong><span className="text-xs text-gray-500">Entrega por el negocio</span></span>
                    </label>
                  ) : null}
                </div>
              </fieldset>

              {fulfillmentType === "delivery" ? (
                <label className="block text-sm font-bold text-gray-700">
                  Dirección de entrega
                  <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} required maxLength={1500} placeholder="Calle, número, colonia, referencias..." className="mt-1.5 min-h-24 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00]" />
                </label>
              ) : null}

              <fieldset>
                <legend className="text-sm font-bold text-gray-700">¿Cómo quieres pagar?</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {orderSettings?.allows_cash ? (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${paymentMethod === "cash" ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                      <input type="radio" name="payment" value="cash" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} className="accent-[#168e00]" />
                      <Banknote className="text-[#168e00]" size={22} />
                      <span><strong className="block text-sm text-gray-900">Efectivo</strong><span className="text-xs text-gray-500">Paga al recoger o recibir</span></span>
                    </label>
                  ) : null}

                  {orderSettings?.online_payment_available ? (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${paymentMethod === "online" ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                      <input type="radio" name="payment" value="online" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} className="accent-[#168e00]" />
                      <CreditCard className="text-[#168e00]" size={22} />
                      <span><strong className="block text-sm text-gray-900">Tarjeta / Mercado Pago</strong><span className="text-xs text-gray-500">Paga en línea de forma segura</span></span>
                    </label>
                  ) : null}
                </div>

                {orderSettings?.allows_online_payment && !orderSettings.online_payment_available ? (
                  <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    El negocio configuró pago en línea, pero temporalmente no está disponible.
                  </p>
                ) : null}
              </fieldset>

              <label className="block text-sm font-bold text-gray-700">
                Notas generales <span className="font-normal text-gray-400">(opcional)</span>
                <textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} maxLength={1500} placeholder="Cualquier indicación general para el negocio" className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-[#168e00]" />
              </label>

              <div className="rounded-2xl bg-[#f2f3f4] p-4">
                <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Productos</span><strong>{cartQuantity}</strong></div>
                <div className="mt-2 flex items-center justify-between"><span className="font-bold text-[#004e28]">Total estimado</span><strong className="text-xl text-[#168e00]">{currencyFormatter.format(cartSubtotal)}</strong></div>
                {paymentMethod === "online" ? <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500"><CreditCard size={13} /> Después de confirmar serás enviado a Mercado Pago.</p> : null}
              </div>

              <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3.5 font-bold text-white hover:bg-[#117500] disabled:opacity-50">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {submitting ? "Creando pedido..." : paymentMethod === "online" ? "Continuar a Mercado Pago" : "Confirmar pedido"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
