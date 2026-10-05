"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { DeliveryAddressEditor } from "@/components/checkout/DeliveryAddressEditor";
import { isValidDeliveryLocation } from "@/lib/deliveryAddress";
import { useDeliveryAddress } from "@/hooks/useDeliveryAddress";
import { distanceKmDriving, LatLngLiteral, parseMapLocation } from "@/lib/googleMaps";
import { getSpanishErrorMessage, translateStockErrorMessage } from "@/lib/errorMessages";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { Loader2, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";

type ProductLite = {
  id: string;
  title: string;
  slug?: string | null;
  sku?: string | null;
  price?: number | string | null;
  stock?: number | null;
  image?: string | null;
  thumbnail_url?: string | null;
};

type CartItem = {
  id: number;
  product_id: string;
  quantity: number;
  supplier_id: number;
  product: ProductLite | null;
};

type SupplierCart = {
  supplier_id: number;
  supplier_user_id: number | null;
  supplier_name: string;
  supplier_is_verified: boolean;
  supplier_map_location: LatLngLiteral | null;
  has_store: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  accepts_courier: boolean | null;
  items: CartItem[];
};

type ToastState = null | { type: "success" | "error" | "info"; message: string };

type DeliveryType = "pickup" | "shipping";

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function buildImageUrl(path: string | null | undefined) {
  if (!path) return "/placeholder.png";
  if (path.startsWith("http") || path.startsWith("https") || path.startsWith("data:")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
}

function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return undefined;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

type AuthFetchOptions = Parameters<typeof fetchWithAuth>[1];

async function tryFetch(urls: string[], options?: AuthFetchOptions) {
  let res: Response | null = null;
  for (const url of urls) {
    res = await fetchWithAuth(url, options);
    if (res.ok) return res;
    if (res.status === 404 || res.status === 405) continue;
    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) continue;
    break;
  }
  return res;
}

function parseSupplierCarts(data: unknown): SupplierCart[] {
  const unwrapList = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (Array.isArray(rec.items)) return rec.items;
      if (Array.isArray(rec.results)) return rec.results;
      if (Array.isArray(rec.data)) return rec.data;
    }
    return [];
  };

  const carts: SupplierCart[] = [];
  for (const row of unwrapList(data)) {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const supplierObj =
      r.supplier && typeof r.supplier === "object" ? (r.supplier as Record<string, unknown>) : null;
    const supplierId = Number(r.supplier_id ?? r.supplierId ?? supplierObj?.id ?? 0);
    if (!supplierId) continue;

    const supplierNameRaw =
      r.supplier_name ??
      r.supplierName ??
      (typeof supplierObj?.name === "string" ? supplierObj.name : null) ??
      (typeof supplierObj?.company_name === "string" ? supplierObj.company_name : null) ??
      null;
    const supplierName = String(supplierNameRaw || "").trim() || `Proveedor #${supplierId}`;
    const supplierUserIdRaw = r.supplier_user_id ?? r.supplierUserId ?? supplierObj?.user_id ?? null;
    const supplierUserId = Number(supplierUserIdRaw);

    const verifiedRaw =
      r.supplier_is_verified ??
      r.is_verified ??
      (typeof supplierObj?.is_verified === "boolean" ? supplierObj.is_verified : null) ??
      null;
    const supplierIsVerified = Boolean(verifiedRaw);

    const rawItems =
      (Array.isArray(r.items) ? r.items : null) ||
      (Array.isArray(r.cart_items) ? r.cart_items : null) ||
      (Array.isArray(r.lines) ? r.lines : null) ||
      [];

    const items: CartItem[] = [];
    for (const it of Array.isArray(rawItems) ? rawItems : []) {
      const item = it && typeof it === "object" ? (it as Record<string, unknown>) : {};
      const itemId = Number(item.id ?? item.item_id ?? item.itemId ?? 0);

      const productCandidate =
        (item.product && typeof item.product === "object" ? (item.product as Record<string, unknown>) : null) ||
        (item.product_detail && typeof item.product_detail === "object"
          ? (item.product_detail as Record<string, unknown>)
          : null);

      const productId = String(item.product_id ?? productCandidate?.id ?? "").trim();
      const quantity = Math.max(1, Number(item.quantity ?? 1) || 1);

      if (!itemId || !productId) continue;

      let product: ProductLite | null = null;
      if (productCandidate) {
        const priceRaw = productCandidate.price ?? item.price ?? null;
        const stock =
          readOptionalNumber(productCandidate.stock) ??
          readOptionalNumber(productCandidate.available_stock) ??
          readOptionalNumber(productCandidate.quantity_available) ??
          readOptionalNumber(item.stock) ??
          readOptionalNumber(item.available_stock) ??
          readOptionalNumber(item.quantity_available);
        product = {
          id: String(productCandidate.id ?? productId),
          title: String(productCandidate.title ?? item.title ?? "Producto"),
          slug:
            typeof productCandidate.slug === "string"
              ? productCandidate.slug
              : typeof productCandidate.product_slug === "string"
                ? productCandidate.product_slug
              : typeof item.slug === "string"
                ? item.slug
                : typeof item.product_slug === "string"
                  ? item.product_slug
                  : null,
          sku: typeof productCandidate.sku === "string" ? productCandidate.sku : typeof item.sku === "string" ? item.sku : null,
          price: typeof priceRaw === "number" || typeof priceRaw === "string" ? priceRaw : null,
          stock,
          image: typeof productCandidate.image === "string" ? productCandidate.image : null,
          thumbnail_url: typeof productCandidate.thumbnail_url === "string" ? productCandidate.thumbnail_url : null,
        };
      } else {
        const title = String(item.title ?? "Producto");
        const priceRaw = item.price ?? null;
        const stock =
          readOptionalNumber(item.stock) ??
          readOptionalNumber(item.available_stock) ??
          readOptionalNumber(item.quantity_available);
        product = {
          id: productId,
          title,
          slug:
            typeof item.slug === "string"
              ? item.slug
              : typeof item.product_slug === "string"
                ? item.product_slug
                : null,
          sku: typeof item.sku === "string" ? item.sku : null,
          price: typeof priceRaw === "number" || typeof priceRaw === "string" ? priceRaw : null,
          stock,
          image: null,
          thumbnail_url: null,
        };
      }

      items.push({ id: itemId, product_id: productId, quantity, supplier_id: supplierId, product });
    }

    if (items.length === 0) continue;
    const supplierMapLoc = parseMapLocation(
      r.supplier_map_location ?? r.map_location ?? supplierObj?.map_location ?? supplierObj?.location ?? null,
    );
    const hasStore = readOptionalBoolean(r.has_store) ?? true;
    const acceptsDelivery = readOptionalBoolean(r.accepts_delivery) ?? false;
    const acceptsPickup = readOptionalBoolean(r.accepts_pickup) ?? false;
    const acceptsCourier = readOptionalBoolean(r.accepts_courier) ?? null;
    carts.push({
      supplier_id: supplierId,
      supplier_user_id: Number.isFinite(supplierUserId) && supplierUserId > 0 ? supplierUserId : null,
      supplier_name: supplierName,
      supplier_is_verified: supplierIsVerified,
      supplier_map_location: supplierMapLoc,
      has_store: hasStore,
      accepts_delivery: hasStore && acceptsDelivery,
      accepts_pickup: hasStore && acceptsPickup,
      accepts_courier: hasStore && acceptsDelivery ? acceptsCourier : false,
      items,
    });
  }

  return carts;
}

export default function ProductCartSection() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [carts, setCarts] = useState<SupplierCart[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const prevSnapshot = useRef<SupplierCart[] | null>(null);
  const isUnmountedRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const delivery = useDeliveryAddress();
  const meUserId = delivery.userId;
  const [saveAddressInProfile, setSaveAddressInProfile] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const quoteRequestRef = useRef(0);
  const [checkoutSupplierId, setCheckoutSupplierId] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [addressLocked, setAddressLocked] = useState(false);
  const checkoutOpeningRef = useRef(false);

  const closeToast = () => setToast(null);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = async () => {
    if (isRedirectingRef.current || isUnmountedRef.current) return;
    setLoading(true);
    try {
      let res = await tryFetch(["/api/cart/", "/api/cart"]);
      if (res && (res.status === 401 || res.status === 403)) {
        await new Promise<void>((r) => window.setTimeout(() => r(), 250));
        res = await tryFetch(["/api/cart/", "/api/cart"]);
      }
      if (!res || !res.ok) {
        if (isRedirectingRef.current || isUnmountedRef.current) return;
        setCarts([]);
        setToast({ type: "error", message: "No se pudo cargar el carrito." });
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      const parsed = parseSupplierCarts(data);
      setCarts(parsed);
    } catch {
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      setCarts([]);
      setToast({ type: "error", message: "Error de conexión al cargar el carrito." });
    } finally {
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onEvent = () => load();
    window.addEventListener("cart:changed", onEvent as EventListener);
    return () => window.removeEventListener("cart:changed", onEvent as EventListener);
  }, []);

  useEffect(() => {
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (carts.length === 0) {
      quoteRequestRef.current += 1;
      setCheckoutSupplierId(null);
      setQuoteLoading(false);
      return;
    }
    if (!checkoutSupplierId || !carts.some((c) => c.supplier_id === checkoutSupplierId)) {
      const firstCart = carts[0];
      setCheckoutSupplierId(firstCart.supplier_id);
      setDeliveryType(firstCart.accepts_pickup ? "pickup" : "shipping");
      setQuoteError(null);
      setShippingCost(null);
      setDistanceKm(null);
      setAddressLocked(false);
      setQuoteLoading(false);
      quoteRequestRef.current += 1;
    }
  }, [carts, checkoutSupplierId]);

  const patchQuantityOptimistic = async (itemId: number, nextQty: number) => {
    const quantity = Math.max(1, Math.floor(nextQty));
    prevSnapshot.current = carts;
    setCarts((prev) =>
      prev.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === itemId ? { ...it, quantity } : it)),
      })),
    );
    setMutating(true);
    try {
      const res = await tryFetch(
        ["/api/cart/update", "/api/cart/update/"],
        { method: "PATCH", body: JSON.stringify({ item_id: itemId, quantity }) },
      );
      if (!res || !res.ok) {
        if (prevSnapshot.current) setCarts(prevSnapshot.current);
        const text = await res?.text().catch(() => "") ?? "";
        let msg = "";
        try {
          msg = text ? getSpanishErrorMessage(JSON.parse(text), "") : "";
        } catch {}
        setToast({
          type: "error",
          message: translateStockErrorMessage(msg || text.trim() || "No se pudo actualizar la cantidad."),
        });
        return;
      }
      setToast({ type: "success", message: "Cantidad actualizada." });
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {
      if (prevSnapshot.current) setCarts(prevSnapshot.current);
      setToast({ type: "error", message: "Error de conexión al actualizar la cantidad." });
    } finally {
      setMutating(false);
      prevSnapshot.current = null;
    }
  };

  const removeItem = async (itemId: number) => {
    prevSnapshot.current = carts;
    setCarts((prev) => prev.map((c) => ({ ...c, items: c.items.filter((it) => it.id !== itemId) })).filter((c) => c.items.length > 0));
    setMutating(true);
    try {
      const res = await tryFetch(
        [`/api/cart/item/${itemId}`, `/api/cart/item/${itemId}/`],
        { method: "DELETE" },
      );
      if (!res || !res.ok) {
        if (prevSnapshot.current) setCarts(prevSnapshot.current);
        const text = await res?.text().catch(() => "") ?? "";
        let msg = "";
        try {
          msg = text ? getSpanishErrorMessage(JSON.parse(text), "") : "";
        } catch {}
        setToast({ type: "error", message: msg || text.trim() || "No se pudo eliminar el producto." });
        return;
      }
      setToast({ type: "success", message: "Producto eliminado." });
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {
      if (prevSnapshot.current) setCarts(prevSnapshot.current);
      setToast({ type: "error", message: "Error de conexión al eliminar el producto." });
    } finally {
      setMutating(false);
      prevSnapshot.current = null;
    }
  };

  const clearSupplier = async (supplierId: number) => {
    prevSnapshot.current = carts;
    setCarts((prev) => prev.filter((c) => c.supplier_id !== supplierId));
    setMutating(true);
    try {
      const res = await tryFetch(
        [
          `/api/cart/clear/${supplierId}`,
          `/api/cart/clear/${supplierId}/`,
        ],
        { method: "DELETE" },
      );
      if (!res || !res.ok) {
        if (prevSnapshot.current) setCarts(prevSnapshot.current);
        const text = await res?.text().catch(() => "") ?? "";
        let msg = "";
        try {
          msg = text ? getSpanishErrorMessage(JSON.parse(text), "") : "";
        } catch {}
        setToast({ type: "error", message: msg || text.trim() || "No se pudo vaciar la tienda." });
        return;
      }
      setToast({ type: "success", message: "Tienda vaciada." });
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {
      if (prevSnapshot.current) setCarts(prevSnapshot.current);
      setToast({ type: "error", message: "Error de conexión al vaciar la tienda." });
    } finally {
      setMutating(false);
      prevSnapshot.current = null;
    }
  };

  const getDefaultDeliveryType = (supplier: SupplierCart): DeliveryType => (supplier.accepts_pickup ? "pickup" : "shipping");

  const startCheckout = async (supplierId: number) => {
    const supplier = carts.find((c) => c.supplier_id === supplierId) || null;
    if (!supplier) return;
    if (!supplier.accepts_pickup && !supplier.accepts_delivery) {
      setToast({ type: "error", message: "Este proveedor no tiene métodos de entrega disponibles por el momento." });
      return;
    }
    setCheckoutSupplierId(supplierId);
    setDeliveryType(supplier.accepts_pickup ? "pickup" : "shipping");
    setQuoteError(null);
    setShippingCost(null);
    setDistanceKm(null);
    setAddressLocked(false);
    setQuoteLoading(false);
    quoteRequestRef.current += 1;
  };

  const invalidateQuote = () => {
    quoteRequestRef.current += 1;
    setQuoteError(null);
    setQuoteLoading(false);
    setShippingCost(null);
    setDistanceKm(null);
    setAddressLocked(false);
  };

  const fetchSupplierDetails = async (supplierId: number) => {
    const res = await tryFetch(
      [`/api/suppliers/${supplierId}`, `/api/suppliers/${supplierId}/`],
      { headers: { Accept: "application/json" } },
    );
    if (!res || !res.ok) return null;
    const data: unknown = await res.json().catch(() => null);
    const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const nested =
      (rec.supplier && typeof rec.supplier === "object" ? (rec.supplier as Record<string, unknown>) : null) ||
      (rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null) ||
      null;
    const src = nested || rec;
    const loc = parseMapLocation(
      src.map_location ?? src.location ?? src.supplier_map_location ?? src.supplierLocation ?? null,
    );
    const hasStore = readOptionalBoolean(src.has_store);
    const acceptsDelivery = readOptionalBoolean(src.accepts_delivery);
    const acceptsPickup = readOptionalBoolean(src.accepts_pickup);
    const acceptsCourier = readOptionalBoolean(src.accepts_courier);
    const supplierUserId = Number(src.user_id ?? src.supplier_user_id ?? 0);
    setCarts((prev) =>
      prev.map((c) => {
        if (Number(c.supplier_id) !== Number(supplierId)) return c;
        const nextHasStore = hasStore ?? c.has_store;
        const nextAcceptsDelivery = nextHasStore && (acceptsDelivery ?? c.accepts_delivery);
        return {
          ...c,
          supplier_user_id: Number.isFinite(supplierUserId) && supplierUserId > 0 ? supplierUserId : c.supplier_user_id,
          supplier_map_location: loc ?? c.supplier_map_location,
          has_store: nextHasStore,
          accepts_delivery: nextAcceptsDelivery,
          accepts_pickup: nextHasStore && (acceptsPickup ?? c.accepts_pickup),
          accepts_courier: nextAcceptsDelivery ? (acceptsCourier ?? c.accepts_courier) : false,
        };
      }),
    );
    return {
      mapLocation: loc,
      has_store: hasStore,
      accepts_delivery: acceptsDelivery,
      accepts_pickup: acceptsPickup,
      accepts_courier: acceptsCourier,
    };
  };

  const computeShippingQuote = async (supplierId: number, force?: boolean) => {
    setQuoteError(null);
    if (!force && deliveryType !== "shipping") return;
    setShippingCost(null);
    setDistanceKm(null);
    setAddressLocked(false);
    const location = delivery.address.location;
    if (!delivery.address.address.trim() || !isValidDeliveryLocation(location)) {
      setQuoteError("Selecciona tu ubicación para calcular el envío.");
      return;
    }
    const requestId = ++quoteRequestRef.current;
    setQuoteLoading(true);
    try {
      let sLoc = carts.find((c) => c.supplier_id === supplierId)?.supplier_map_location ?? null;
      if (!sLoc) {
        const details = await fetchSupplierDetails(supplierId);
        sLoc = details?.mapLocation ?? null;
      }
      if (requestId !== quoteRequestRef.current) return;
      if (!sLoc) {
        setQuoteError("Este negocio aún no tiene una ubicación configurada y no es posible calcular el envío.");
        return;
      }
      const km = await distanceKmDriving(location, sLoc);
      if (requestId !== quoteRequestRef.current) return;
      if (!Number.isFinite(km) || km < 0) throw new Error("Distancia inválida");
      const res = await tryFetch(
        ["/api/cart/shipping-quote", "/api/cart/shipping-quote/"],
        {
          method: "POST",
          body: JSON.stringify({ supplier_id: supplierId, distance_km: km }),
          headers: { Accept: "application/json" },
        },
      );
      if (requestId !== quoteRequestRef.current) return;
      if (!res) {
        setQuoteError("No se pudo calcular el costo de envío.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (requestId !== quoteRequestRef.current) return;
        const msg =
          (typeof data.detail === "string" && data.detail) ||
          (typeof data.message === "string" && data.message) ||
          "No se pudo calcular el costo de envío.";
        setQuoteError(msg);
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      if (requestId !== quoteRequestRef.current) return;
      const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const rawCost = rec.shipping_cost ?? rec.cost ?? rec.amount;
      const parsedCost =
        typeof rawCost === "number"
          ? rawCost
          : typeof rawCost === "string"
            ? Number.parseFloat(rawCost.replace(/[^\d.-]/g, ""))
            : NaN;
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        setQuoteError("No se pudo calcular el costo de envío.");
        return;
      }
      setDistanceKm(km);
      setShippingCost(parsedCost);
      setAddressLocked(true);
    } catch {
      if (requestId !== quoteRequestRef.current) return;
      setQuoteError("No se pudo calcular el costo de envío.");
    } finally {
      if (requestId === quoteRequestRef.current) setQuoteLoading(false);
    }
  };

  const confirmCheckout = async (supplierId: number, deliveryOverride?: DeliveryType) => {
    if (checkoutOpeningRef.current || isRedirectingRef.current) return;
    checkoutOpeningRef.current = true;
    const selectedDeliveryType = deliveryOverride ?? deliveryType;
    const selectedSupplier = carts.find((c) => c.supplier_id === supplierId) || null;
    const requiresShippingQuote =
      selectedDeliveryType === "shipping" && Boolean(selectedSupplier?.accepts_delivery);
    setMutating(true);
    try {
      if (!selectedSupplier) {
        setToast({ type: "error", message: "No se encontró el proveedor de este carrito." });
        return;
      }
      if (selectedSupplier?.supplier_user_id && meUserId && Number(selectedSupplier.supplier_user_id) === Number(meUserId)) {
        setToast({ type: "error", message: "No puedes comprar productos de tu propia cuenta." });
        return;
      }
      if (selectedDeliveryType === "pickup" && !selectedSupplier.accepts_pickup) {
        setToast({ type: "error", message: "Este proveedor no ofrece recolección en tienda." });
        return;
      }
      if (selectedDeliveryType === "shipping" && !selectedSupplier.accepts_delivery) {
        setToast({ type: "error", message: "Este proveedor no ofrece envío a domicilio." });
        return;
      }
      if (requiresShippingQuote) {
        if (!isValidDeliveryLocation(delivery.address.location)) {
          setToast({ type: "error", message: "Selecciona tu ubicación para el envío." });
          return;
        }
        if (!delivery.address.address.trim()) {
          setToast({ type: "error", message: "Escribe la dirección para el envío." });
          return;
        }
        if (!addressLocked || shippingCost == null) {
          setToast({ type: "error", message: "Primero calcula el costo de envío." });
          return;
        }
        if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) {
          setToast({ type: "error", message: "Calcula nuevamente la distancia para el envío." });
          return;
        }
        if (!saveAddressInProfile && delivery.hasChanges) {
          setToast({ type: "error", message: "El checkout de Productos usa la dirección de tu perfil. Activa ‘Guardar esta dirección en mi perfil’ para comprar con la dirección nueva." });
          return;
        }
      }
      if (requiresShippingQuote && saveAddressInProfile) {
        setProfileSaving(true);
        try {
          await delivery.saveToProfile();
        } catch (error) {
          setToast({ type: "error", message: error instanceof Error ? error.message : "No pudimos guardar tu nueva dirección." });
          return;
        } finally {
          setProfileSaving(false);
        }
      }
      const items = (selectedSupplier?.items || [])
        .map((it) => ({ product_id: String(it.product_id || "").trim(), quantity: Number(it.quantity) || 0 }))
        .filter((it) => it.product_id && it.quantity > 0);
      if (!items.length) {
        setToast({ type: "error", message: "No hay productos válidos para iniciar el checkout." });
        return;
      }
      const subtotal = selectedSupplier.items.reduce((sum, item) => {
        const rawPrice = item.product?.price ?? 0;
        const price = typeof rawPrice === "number" ? rawPrice : Number(String(rawPrice).replace(/[^\d.-]/g, "")) || 0;
        return sum + price * item.quantity;
      }, 0);
      const estimatedTotal = subtotal + (requiresShippingQuote ? Number(shippingCost || 0) : 0);
      if (!Number.isFinite(estimatedTotal) || estimatedTotal <= 0) {
        setToast({ type: "error", message: "El total estimado del carrito no es válido." });
        return;
      }

      const response = await fetchWithAuth("/api/orders/checkout", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          delivery_type: selectedDeliveryType,
          payment_method: "card",
          distance_km: selectedDeliveryType === "shipping" ? distanceKm : null,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getSpanishErrorMessage(data, "No se pudo iniciar el pago con Mercado Pago. Inténtalo nuevamente."));
      }
      const preference = data && typeof data === "object" ? (data as Record<string, unknown>).preference : null;
      const initPoint = preference && typeof preference === "object"
        ? (preference as Record<string, unknown>).init_point
        : null;
      const safeInitPoint = getSafeMercadoPagoUrl(typeof initPoint === "string" ? initPoint : null);
      if (!safeInitPoint) {
        setToast({ type: "error", message: "No se pudo iniciar el pago con Mercado Pago. Inténtalo nuevamente." });
        return;
      }
      isRedirectingRef.current = true;
      window.location.assign(safeInitPoint);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "No se pudo iniciar el pago con Mercado Pago. Inténtalo nuevamente." });
    } finally {
      checkoutOpeningRef.current = false;
      setMutating(false);
    }
  };

  const isEmpty = !loading && carts.length === 0;

  return (
    <div className="font-[family-name:var(--font-poppins)]">
      <div className="space-y-6">
        <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">Productos</h2>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
                <div className="h-6 w-48 bg-gray-100 rounded" />
                <div className="mt-4 space-y-3">
                  <div className="h-20 bg-gray-100 rounded-xl" />
                  <div className="h-20 bg-gray-100 rounded-xl" />
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
                <div className="h-6 w-40 bg-gray-100 rounded" />
                <div className="mt-4 space-y-3">
                  <div className="h-20 bg-gray-100 rounded-xl" />
                  <div className="h-20 bg-gray-100 rounded-xl" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="h-6 w-32 bg-gray-100 rounded" />
              <div className="mt-4 space-y-3">
                <div className="h-5 w-full bg-gray-100 rounded" />
                <div className="h-5 w-4/5 bg-gray-100 rounded" />
                <div className="h-10 w-full bg-gray-100 rounded-xl" />
              </div>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-lg font-bold text-gray-900">No tienes productos en el carrito.</p>
            <p className="text-sm text-gray-500 mt-2">¡Explora los mejores gadgets en Drooopy!</p>
            <Link href="/" className="inline-flex mt-5 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {carts.map((c) => {
              const supplierSubtotal = c.items.reduce((sum, it) => {
                const priceRaw = it.product?.price ?? 0;
                const price =
                  typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;
                return sum + price * (Number(it.quantity) || 0);
              }, 0);
              const isActiveCheckout = checkoutSupplierId === c.supplier_id;
              const visibleDeliveryType = isActiveCheckout ? deliveryType : getDefaultDeliveryType(c);
              const visibleShippingNeedsQuote = visibleDeliveryType === "shipping" && c.accepts_delivery;
              const isOwnSupplierCart = Boolean(c.supplier_user_id && meUserId && Number(c.supplier_user_id) === Number(meUserId));
              const hasValidQuote = isActiveCheckout && visibleShippingNeedsQuote && addressLocked && shippingCost != null;
              const supplierTotal = visibleShippingNeedsQuote
                ? hasValidQuote ? supplierSubtotal + shippingCost : null
                : supplierSubtotal;
              const cannotPay =
                mutating ||
                profileSaving ||
                delivery.loading ||
                isOwnSupplierCart ||
                (!c.accepts_pickup && !c.accepts_delivery) ||
                (visibleShippingNeedsQuote && !hasValidQuote);

              return (
                <div key={c.supplier_id} className="rounded-2xl bg-white overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                      <button type="button" onClick={() => startCheckout(c.supplier_id)} className="min-w-0 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{c.supplier_name}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() => clearSupplier(c.supplier_id)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                        Vaciar tienda
                      </button>
                    </div>
                    <div className="px-5 py-4 border-t border-gray-100 space-y-5">
                      <p className="text-sm font-bold text-gray-900">Entrega y pago</p>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-2">Método de entrega</p>
                        <div className="flex flex-wrap items-center gap-3">
                          {c.accepts_pickup ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCheckoutSupplierId(c.supplier_id);
                                setDeliveryType("pickup");
                                invalidateQuote();
                              }}
                              className={cn(
                                "px-3 py-2 rounded-lg border",
                                visibleDeliveryType === "pickup" ? "border-primary text-primary" : "border-gray-200 text-gray-700",
                              )}
                            >
                              Recojo en tienda
                            </button>
                          ) : null}
                          {c.accepts_delivery ? (
                            <button
                              type="button"
                              disabled={delivery.loading}
                              onClick={async () => {
                                setCheckoutSupplierId(c.supplier_id);
                                setDeliveryType("shipping");
                                invalidateQuote();
                              }}
                              className={cn(
                                "px-3 py-2 rounded-lg border disabled:opacity-50",
                                visibleDeliveryType === "shipping" ? "border-primary text-primary" : "border-gray-200 text-gray-700",
                              )}
                            >
                              Envío a domicilio
                            </button>
                          ) : null}
                        </div>
                        {!c.accepts_pickup && !c.accepts_delivery ? (
                          <p className="mt-2 text-sm text-red-600">Este proveedor no tiene métodos de entrega disponibles.</p>
                        ) : null}
                        {isOwnSupplierCart ? (
                          <p className="mt-2 text-sm text-red-600">No puedes comprar productos de tu propia cuenta.</p>
                        ) : null}
                      </div>
                      {isActiveCheckout && visibleShippingNeedsQuote && (
                          <div className="space-y-4 rounded-2xl border border-[#d7e8d8] bg-white p-3 sm:p-4">
                            {delivery.loadError ? <p className="text-sm text-amber-700">{delivery.loadError} Puedes capturar tu dirección aquí.</p> : null}
                            {delivery.loading ? (
                              <p className="text-sm text-gray-500">Cargando tu dirección guardada...</p>
                            ) : (
                              <DeliveryAddressEditor
                                address={delivery.address}
                                onFieldChange={(field, value) => { delivery.setField(field, value); invalidateQuote(); }}
                                onLocationChange={(location) => { delivery.setLocation(location); invalidateQuote(); }}
                                onPlaceChange={(place) => { delivery.selectPlace(place); invalidateQuote(); }}
                                isAuthenticated={delivery.isAuthenticated}
                                saveToProfile={saveAddressInProfile}
                                onSaveToProfileChange={setSaveAddressInProfile}
                                mapHeight="240px"
                              />
                            )}
                            {delivery.address.location ? (
                              <p className="break-words text-xs text-gray-500">
                                Ubicación seleccionada: {delivery.address.location.lat.toFixed(5)}, {delivery.address.location.lng.toFixed(5)}
                              </p>
                            ) : null}
                            {!saveAddressInProfile && delivery.hasChanges ? (
                              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                                Para comprar Productos con esta dirección nueva, debes guardarla en tu perfil.
                                {!delivery.loadError ? <button type="button" onClick={() => { delivery.resetToSaved(); invalidateQuote(); }} className="ml-1 font-bold underline">Usar mi dirección guardada</button> : null}
                              </div>
                            ) : null}
                            <div className="rounded-xl bg-[#f2f3f4] p-3 text-sm" aria-live="polite">
                              {quoteLoading ? (
                                <p className="flex items-center gap-2 font-semibold text-[#004e28]"><Loader2 size={16} className="animate-spin" />Calculando envío...</p>
                              ) : quoteError ? (
                                <div className="space-y-2 text-red-700">
                                  <p>{quoteError}</p>
                                  <button type="button" onClick={() => void computeShippingQuote(c.supplier_id)} className="font-bold underline">Reintentar</button>
                                </div>
                              ) : hasValidQuote ? (
                                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 font-semibold text-[#004e28]">
                                  <span>Distancia: {distanceKm?.toFixed(1)} km</span>
                                  <span>Envío: {money(shippingCost)}</span>
                                </div>
                              ) : (
                                <p className="text-gray-600">{!delivery.address.address.trim() || !isValidDeliveryLocation(delivery.address.location)
                                  ? "Selecciona tu ubicación para calcular el envío."
                                  : "Calcula el envío para conocer el total."}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => computeShippingQuote(c.supplier_id)}
                              disabled={quoteLoading || mutating || profileSaving || delivery.loading || !delivery.address.address.trim() || !isValidDeliveryLocation(delivery.address.location)}
                              className={cn(
                                "w-full px-5 py-3 rounded-xl font-bold text-sm",
                                quoteLoading || mutating || profileSaving || delivery.loading || !delivery.address.address.trim() || !isValidDeliveryLocation(delivery.address.location)
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-primary text-white hover:bg-primary/90",
                              )}
                            >
                              {quoteLoading ? "Calculando envío..." : hasValidQuote ? "Recalcular envío" : "Calcular envío"}
                            </button>
                          </div>
                      )}
                      <div className="pt-2">
                        <p className="text-sm font-semibold text-gray-800 mb-2">Método de pago</p>
                        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          Pago con tarjeta
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {c.items.map((it) => {
                        const img = it.product?.thumbnail_url || it.product?.image || null;
                        const priceRaw = it.product?.price ?? 0;
                        const price =
                          typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;
                        const lineTotal = price * (Number(it.quantity) || 0);
                        const sku = String(it.product?.sku || "").trim();
                        const stock = it.product?.stock;
                        const productHref = `/product/${encodeURIComponent(String(it.product?.slug || it.product?.id || it.product_id))}`;

                        return (
                          <div key={it.id} className="px-5 py-4 flex gap-4 items-start">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={productHref}
                                className="group flex min-w-0 gap-4 rounded-xl outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary/40"
                              >
                                <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shrink-0">
                                  <img src={buildImageUrl(img)} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 py-0.5">
                                  <p className="font-semibold text-gray-900 truncate transition-colors group-hover:text-[#004e28]">
                                    {it.product?.title || "Producto"}
                                  </p>
                                  {sku ? <p className="text-xs text-gray-500 mt-0.5">SKU: {sku}</p> : null}
                                  {typeof stock === "number" ? (
                                    <p className="mt-1 text-xs font-semibold text-[#168e00]">
                                      {stock === 1 ? "1 disponible" : `${stock} disponibles`}
                                    </p>
                                  ) : null}
                                </div>
                              </Link>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => patchQuantityOptimistic(it.id, it.quantity - 1)}
                                    disabled={mutating || it.quantity <= 1}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Disminuir cantidad"
                                  >
                                    <Minus size={16} />
                                  </button>
                                  <div className="w-12 h-10 flex items-center justify-center font-semibold text-gray-900">
                                    {it.quantity}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => patchQuantityOptimistic(it.id, it.quantity + 1)}
                                    disabled={mutating}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Aumentar cantidad"
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>

                                <div className="flex items-center gap-3">
                                  <p className="font-bold text-gray-900">{money(lineTotal)}</p>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(it.id)}
                                    disabled={mutating}
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Eliminar producto"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/70">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm text-gray-600">
                          <div className="flex items-center justify-between gap-8 sm:justify-start">
                            <span>Subtotal productos</span>
                            <span className="font-bold text-gray-900">{money(supplierSubtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-8 sm:justify-start">
                            <span>Envío</span>
                            <span className="font-bold text-gray-900">{visibleShippingNeedsQuote ? hasValidQuote ? money(shippingCost) : "Pendiente" : money(0)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-8 pt-2 sm:justify-start">
                            <span className="font-bold text-gray-900">Total</span>
                            <span className="font-bold text-gray-900">{supplierTotal == null ? "Pendiente" : money(supplierTotal)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!isActiveCheckout) {
                              const selectedDeliveryType = getDefaultDeliveryType(c);
                              await startCheckout(c.supplier_id);
                              if (selectedDeliveryType === "shipping") return;
                              await confirmCheckout(c.supplier_id, selectedDeliveryType);
                              return;
                            }
                            confirmCheckout(c.supplier_id).catch(() => {});
                          }}
                          disabled={cannotPay}
                          className={cn(
                            "w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm",
                            cannotPay
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "bg-[#168e00] text-white hover:bg-[#137500]",
                          )}
                        >
                          {mutating || profileSaving ? "Procesando..." : "Finalizar compra"}
                        </button>
                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
