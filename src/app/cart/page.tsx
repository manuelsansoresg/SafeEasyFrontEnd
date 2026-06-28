"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { distanceKmDriving, LatLngLiteral, parseMapLocation } from "@/lib/googleMaps";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { Minus, Plus, ShieldCheck, Trash2, X } from "lucide-react";

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

type AddressForm = {
  address: string;
  exterior_number: string;
  interior_number: string;
  cp: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

function addressHash(form: AddressForm, loc: LatLngLiteral | null) {
  const normalized: Record<string, unknown> = {
    address: String(form.address || "").trim(),
    exterior_number: String(form.exterior_number || "").trim(),
    interior_number: String(form.interior_number || "").trim(),
    cp: String(form.cp || "").trim(),
    neighborhood: String(form.neighborhood || "").trim(),
    city: String(form.city || "").trim(),
    state: String(form.state || "").trim(),
    country: String(form.country || "").trim(),
    map_location: loc ? { lat: Number(loc.lat) || 0, lng: Number(loc.lng) || 0 } : null,
  };
  return JSON.stringify(normalized);
}

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

export default function CartPage() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [carts, setCarts] = useState<SupplierCart[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const prevSnapshot = useRef<SupplierCart[] | null>(null);
  const isUnmountedRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const addressDirtyRef = useRef(false);
  const [checkoutSupplierId, setCheckoutSupplierId] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [meUserId, setMeUserId] = useState<number | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    address: "",
    exterior_number: "",
    interior_number: "",
    cp: "",
    neighborhood: "",
    city: "Mérida",
    state: "Yucatán",
    country: "México",
  });
  const [userMapLocation, setUserMapLocation] = useState<LatLngLiteral | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [, setSupplierMapLocation] = useState<LatLngLiteral | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [addressLocked, setAddressLocked] = useState(false);
  const lastSavedAddressHashRef = useRef("");
  const [paymentModal, setPaymentModal] = useState<null | { init_point: string; order_id: number | null }>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalSaving, setAddressModalSaving] = useState(false);

  const closeToast = () => setToast(null);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    const loadMe = async () => {
      setMeLoading(true);
      try {
        const res = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data: unknown = await res.json().catch(() => null);
        if (!data || typeof data !== "object") return;
        const rec = data as Record<string, unknown>;
        const nested =
          (rec.user && typeof rec.user === "object" ? (rec.user as Record<string, unknown>) : null) ||
          (rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null) ||
          null;
        const src = nested || rec;

        const idNum = Number(src.id ?? rec.id ?? 0);
        if (Number.isFinite(idNum) && idNum > 0) setMeUserId(idNum);
        const nextForm = {
          address: String(src.address || src.street || rec.address || rec.street || "").trim(),
          exterior_number: String(src.exterior_number || src.outdoor_number || rec.exterior_number || rec.outdoor_number || "").trim(),
          interior_number: String(src.interior_number || src.indoor_number || rec.interior_number || rec.indoor_number || "").trim(),
          cp: String(src.cp || src.zip_code || src.postal_code || rec.cp || rec.zip_code || rec.postal_code || "").trim(),
          neighborhood: String(src.neighborhood || src.colonia || rec.neighborhood || rec.colonia || "").trim(),
          city: String(src.city || rec.city || "Mérida"),
          state: String(src.state || rec.state || "Yucatán"),
          country: String(src.country || rec.country || "México"),
        };
        const loc = parseMapLocation(src.map_location ?? rec.map_location ?? null);
        if (!addressDirtyRef.current) {
          setAddressForm(nextForm);
          if (loc) setUserMapLocation(loc);
          lastSavedAddressHashRef.current = addressHash(nextForm, loc);
        } else if (!userMapLocation && loc) {
          setUserMapLocation(loc);
        }
      } catch {}
      finally {
        setMeLoading(false);
      }
    };
    loadMe();
  }, []);

  const reloadMeAddress = async () => {
    setMeLoading(true);
    try {
      const res = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object") return;
      const rec = data as Record<string, unknown>;
      const nested =
        (rec.user && typeof rec.user === "object" ? (rec.user as Record<string, unknown>) : null) ||
        (rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null) ||
        null;
      const src = nested || rec;

      const idNum = Number(src.id ?? rec.id ?? 0);
      if (Number.isFinite(idNum) && idNum > 0) setMeUserId(idNum);
      const nextForm = {
        address: String(src.address || src.street || rec.address || rec.street || "").trim(),
        exterior_number: String(src.exterior_number || src.outdoor_number || rec.exterior_number || rec.outdoor_number || "").trim(),
        interior_number: String(src.interior_number || src.indoor_number || rec.interior_number || rec.indoor_number || "").trim(),
        cp: String(src.cp || src.zip_code || src.postal_code || rec.cp || rec.zip_code || rec.postal_code || "").trim(),
        neighborhood: String(src.neighborhood || src.colonia || rec.neighborhood || rec.colonia || "").trim(),
        city: String(src.city || rec.city || "Mérida"),
        state: String(src.state || rec.state || "Yucatán"),
        country: String(src.country || rec.country || "México"),
      };
      const loc = parseMapLocation(src.map_location ?? rec.map_location ?? null);
      setAddressForm(nextForm);
      if (loc) setUserMapLocation(loc);
      lastSavedAddressHashRef.current = addressHash(nextForm, loc);
    } catch {}
    finally {
      setMeLoading(false);
    }
  };

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
      setCheckoutSupplierId(null);
      return;
    }
    if (!checkoutSupplierId || !carts.some((c) => c.supplier_id === checkoutSupplierId)) {
      const firstCart = carts[0];
      setCheckoutSupplierId(firstCart.supplier_id);
      setDeliveryType(firstCart.accepts_pickup ? "pickup" : "shipping");
      setQuoteError(null);
      setShippingCost(null);
      setDistanceKm(null);
      setSupplierMapLocation(null);
      setAddressLocked(false);
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
        setToast({ type: "error", message: text.trim() || "No se pudo actualizar la cantidad." });
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
        setToast({ type: "error", message: text.trim() || "No se pudo eliminar el producto." });
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
        setToast({ type: "error", message: text.trim() || "No se pudo vaciar la tienda." });
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

  const saveAddress = async () => {
    if (!meUserId) return true;
    const nextHash = addressHash(addressForm, userMapLocation);
    if (nextHash === lastSavedAddressHashRef.current) return true;
    setSavingAddress(true);
    try {
      const body: Record<string, unknown> = {
        address: addressForm.address,
        exterior_number: addressForm.exterior_number,
        interior_number: addressForm.interior_number,
        cp: addressForm.cp,
        neighborhood: addressForm.neighborhood,
        city: addressForm.city,
        state: addressForm.state,
        country: addressForm.country,
      };
      if (userMapLocation) body.map_location = `${userMapLocation.lat},${userMapLocation.lng}`;
      const res = await fetchWithAuth(`/api/users/${meUserId}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (typeof data.detail === "string" && data.detail) ||
          (typeof data.message === "string" && data.message) ||
          "No se pudo guardar la dirección.";
        setToast({ type: "error", message: msg });
        return false;
      }
      if (userMapLocation) {
        const mapRes = await fetchWithAuth(`/api/users/${meUserId}/map-location`, {
          method: "PATCH",
          body: JSON.stringify({ map_location: `${userMapLocation.lat},${userMapLocation.lng}` }),
          headers: { Accept: "application/json" },
        });
        if (!mapRes.ok) {
          const data = await mapRes.json().catch(() => ({}));
          const msg =
            (typeof data.detail === "string" && data.detail) ||
            (typeof data.message === "string" && data.message) ||
            "No se pudo guardar la ubicación en el mapa.";
          setToast({ type: "error", message: msg });
          return false;
        }
      }
      lastSavedAddressHashRef.current = nextHash;
      return true;
    } catch {
      setToast({ type: "error", message: "Error de conexión al guardar la dirección." });
      return false;
    } finally {
      setSavingAddress(false);
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
    const cached = supplier.supplier_map_location ?? null;
    setSupplierMapLocation(cached);
    setAddressLocked(false);
  };

  const invalidateQuote = () => {
    setQuoteError(null);
    setShippingCost(null);
    setDistanceKm(null);
    setAddressLocked(false);
  };

  const saveAddressOnly = async () => {
    setQuoteError(null);
    if (!meUserId) {
      setToast({ type: "error", message: "Inicia sesión para guardar tu dirección." });
      return;
    }
    if (!userMapLocation) {
      setQuoteError("Selecciona tu ubicación en el mapa.");
      return;
    }
    setAddressModalSaving(true);
    try {
      const saved = await saveAddress();
      if (!saved) return;
      addressDirtyRef.current = false;
      setAddressModalOpen(false);
      if (deliveryType === "shipping" && checkoutSupplierId != null) {
        window.setTimeout(() => {
          computeShippingQuote(checkoutSupplierId, true).catch(() => {});
        }, 0);
      }
    } finally {
      setAddressModalSaving(false);
    }
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
    const supplierBeforeFetch = carts.find((c) => c.supplier_id === supplierId) ?? null;
    let supplierAcceptsCourier = supplierBeforeFetch?.accepts_courier ?? null;
    if (supplierAcceptsCourier == null) {
      const details = await fetchSupplierDetails(supplierId);
      supplierAcceptsCourier = details?.accepts_courier ?? supplierAcceptsCourier;
    }
    if (supplierAcceptsCourier === false) return;
    if (!userMapLocation || addressDirtyRef.current) {
      setCheckoutSupplierId(supplierId);
      setAddressModalOpen(true);
      return;
    }

    let sLoc = carts.find((c) => c.supplier_id === supplierId)?.supplier_map_location ?? null;
    if (!sLoc) {
      const details = await fetchSupplierDetails(supplierId);
      sLoc = details?.mapLocation ?? null;
    }
    if (!sLoc) {
      setQuoteError("No se pudo obtener la ubicación del proveedor.");
      return;
    }

    setQuoteLoading(true);
    try {
      const km = await distanceKmDriving(userMapLocation, sLoc);
      setDistanceKm(km);
      const res = await tryFetch(
        ["/api/cart/shipping-quote", "/api/cart/shipping-quote/"],
        {
          method: "POST",
          body: JSON.stringify({ supplier_id: supplierId, distance_km: km }),
          headers: { Accept: "application/json" },
        },
      );
      if (!res) {
        setQuoteError("No se pudo cotizar el envío.");
        setShippingCost(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (typeof data.detail === "string" && data.detail) ||
          (typeof data.message === "string" && data.message) ||
          "No se pudo cotizar el envío.";
        setQuoteError(msg);
        setShippingCost(null);
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const rawCost = rec.shipping_cost ?? rec.cost ?? rec.amount ?? 0;
      const parsedCost =
        typeof rawCost === "number"
          ? rawCost
          : typeof rawCost === "string"
            ? Number.parseFloat(rawCost.replace(/[^\d.-]/g, "")) || 0
            : Number(rawCost) || 0;
      setShippingCost(Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0);
      setAddressLocked(true);
    } catch {
      setQuoteError("Error al calcular distancia o cotizar envío.");
      setShippingCost(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const extractInitPoint = (payload: unknown) => {
    const asRec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
    const pick = (rec: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) {
        const v = rec[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };
    const raw = asRec(payload);
    const preference = raw.preference && typeof raw.preference === "object" ? (raw.preference as Record<string, unknown>) : {};
    const payment = raw.payment && typeof raw.payment === "object" ? (raw.payment as Record<string, unknown>) : {};
    return (
      pick(raw, ["init_point", "mp_init_point", "mercadopago_init_point", "payment_url", "checkout_url"]) ||
      pick(preference, ["init_point"]) ||
      pick(payment, ["init_point", "mp_init_point", "mercadopago_init_point", "payment_url", "checkout_url"])
    );
  };

  const confirmCheckout = async (supplierId: number, deliveryOverride?: DeliveryType) => {
    const selectedDeliveryType = deliveryOverride ?? deliveryType;
    const selectedSupplier = carts.find((c) => c.supplier_id === supplierId) || null;
    const requiresShippingQuote =
      selectedDeliveryType === "shipping" && Boolean(selectedSupplier?.accepts_delivery) && selectedSupplier?.accepts_courier !== false;
    setMutating(true);
    try {
      if (selectedSupplier?.supplier_user_id && meUserId && Number(selectedSupplier.supplier_user_id) === Number(meUserId)) {
        setToast({ type: "error", message: "No puedes comprar productos de tu propia cuenta." });
        return;
      }
      if (requiresShippingQuote) {
        if (!userMapLocation) {
          setToast({ type: "error", message: "Selecciona tu ubicación para el envío." });
          return;
        }
        if (!addressLocked || shippingCost == null) {
          setToast({ type: "error", message: "Primero calcula el costo de envío." });
          return;
        }
      }
      const saved = await saveAddress();
      if (!saved) return;
      const items = (selectedSupplier?.items || [])
        .map((it) => ({ product_id: String(it.product_id || "").trim(), quantity: Number(it.quantity) || 0 }))
        .filter((it) => it.product_id && it.quantity > 0);
      if (!items.length) {
        setToast({ type: "error", message: "No hay productos válidos para iniciar el checkout." });
        return;
      }
      const payload: Record<string, unknown> = {
        items,
        delivery_type: selectedDeliveryType,
        payment_method: "card",
        distance_km: 0,
        courier_user_id: 0,
      };
      if (requiresShippingQuote && Number.isFinite(distanceKm || 0)) {
        payload.distance_km = distanceKm;
      }
      const res = await tryFetch(
        [
          `/api/orders/checkout`,
          `/api/orders/checkout/`,
        ],
        { method: "POST", body: JSON.stringify(payload), headers: { Accept: "application/json" } },
      );
      if (!res || !res.ok) {
        const raw = await res?.text().catch(() => "");
        let record: Record<string, unknown> = {};
        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object") record = parsed as Record<string, unknown>;
          } catch {}
        }
        const rawText = raw ? raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
        const msg =
          (typeof record.detail === "string" && record.detail.trim()) ||
          (typeof record.message === "string" && record.message.trim()) ||
          (typeof record.error === "string" && record.error.trim()) ||
          (rawText ? rawText.slice(0, 180) : "") ||
          `No se pudo iniciar el checkout (HTTP ${res?.status ?? "?"}).`;
        setToast({ type: "error", message: msg });
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const orderObj = record.order && typeof record.order === "object" ? (record.order as Record<string, unknown>) : null;
      const nestedId = orderObj ? orderObj.id : null;
      const orderId = Number(record.order_id ?? record.id ?? record.orderId ?? nestedId ?? 0);
      try {
        if (orderId) {
          const key = `drooopy:checkout:${orderId}`;
          sessionStorage.setItem(key, JSON.stringify(data));
        }
      } catch {}
      const initPoint = extractInitPoint(data);
      const safeInitPoint = getSafeMercadoPagoUrl(initPoint);
      if (safeInitPoint) {
        isRedirectingRef.current = true;
        setCheckoutSupplierId(null);
        window.dispatchEvent(new CustomEvent("cart:changed"));
        window.location.href = safeInitPoint;
        return;
      }

      if (orderId) {
        const orderRes = await tryFetch(
          [`/api/orders/${orderId}`, `/api/orders/${orderId}/`],
          { headers: { Accept: "application/json" } },
        );
        if (orderRes && orderRes.ok) {
          const orderData: unknown = await orderRes.json().catch(() => null);
          const fetchedInitPoint = extractInitPoint(orderData);
          const safeFetchedInitPoint = getSafeMercadoPagoUrl(fetchedInitPoint);
          if (safeFetchedInitPoint) {
            isRedirectingRef.current = true;
            setCheckoutSupplierId(null);
            window.dispatchEvent(new CustomEvent("cart:changed"));
            window.location.href = safeFetchedInitPoint;
            return;
          }
        }
      }

      window.dispatchEvent(new CustomEvent("cart:changed"));
      setToast({ type: "error", message: "No se recibió el link de pago (init_point) para Mercado Pago." });
    } catch {
      setToast({ type: "error", message: "Error de conexión al iniciar el checkout." });
    } finally {
      setMutating(false);
    }
  };

  const isEmpty = !loading && carts.length === 0;

  return (
    <div className="font-[family-name:var(--font-poppins)]">
      <div className="space-y-6">
        <PageHero title="Mi Carrito" subtitle="Revisa tus productos seleccionados y completa tu compra." />

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
            <p className="text-lg font-bold text-gray-900">Tu carrito está vacío.</p>
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
              const visibleShippingNeedsQuote = visibleDeliveryType === "shipping" && c.accepts_delivery && c.accepts_courier !== false;
              const isOwnSupplierCart = Boolean(c.supplier_user_id && meUserId && Number(c.supplier_user_id) === Number(meUserId));
              const supplierTotal =
                supplierSubtotal +
                (isActiveCheckout && visibleShippingNeedsQuote && shippingCost != null && addressLocked ? shippingCost : 0);
              const cannotPay =
                mutating ||
                savingAddress ||
                meLoading ||
                isOwnSupplierCart ||
                (!c.accepts_pickup && !c.accepts_delivery) ||
                (isActiveCheckout && visibleShippingNeedsQuote && (!addressLocked || shippingCost == null));

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
                        <div className="flex items-center gap-3">
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
                              onClick={async () => {
                                setCheckoutSupplierId(c.supplier_id);
                                setDeliveryType("shipping");
                                invalidateQuote();
                                const details = c.accepts_courier == null ? await fetchSupplierDetails(c.supplier_id) : null;
                                const acceptsCourier = details?.accepts_courier ?? c.accepts_courier;
                                if (acceptsCourier !== false) computeShippingQuote(c.supplier_id, true).catch(() => {});
                              }}
                              className={cn(
                                "px-3 py-2 rounded-lg border",
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
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-800">Dirección de entrega</p>
                              <button
                                type="button"
                                onClick={async () => {
                                  setCheckoutSupplierId(c.supplier_id);
                                  invalidateQuote();
                                  addressDirtyRef.current = false;
                                  await reloadMeAddress();
                                  setAddressModalOpen(true);
                                }}
                                className="text-xs font-semibold text-gray-700 hover:underline"
                              >
                                {addressForm.address || userMapLocation ? "Modificar" : "Establecer"}
                              </button>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                              {addressForm.address.trim() ||
                              addressForm.exterior_number.trim() ||
                              addressForm.cp.trim() ||
                              addressForm.neighborhood.trim() ? (
                                <p className="truncate">
                                  {[
                                    String(addressForm.address || "").trim(),
                                    String(addressForm.exterior_number || "").trim(),
                                    String(addressForm.neighborhood || "").trim(),
                                    String(addressForm.cp || "").trim(),
                                    String(addressForm.city || "").trim(),
                                    String(addressForm.state || "").trim(),
                                    String(addressForm.country || "").trim(),
                                  ]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>
                              ) : userMapLocation ? (
                                <p className="text-gray-500">Ubicación guardada en el mapa.</p>
                              ) : (
                                <p className="text-gray-500">No tienes dirección configurada. Establécela para calcular el envío.</p>
                              )}
                            </div>
                            {addressLocked && shippingCost != null ? (
                              <div className="text-sm text-gray-700 mt-2">
                                Envío cotizado: <b>{money(shippingCost)}</b>
                                {distanceKm != null ? <span className="text-gray-500"> · {distanceKm.toFixed(1)} km</span> : null}
                              </div>
                            ) : null}
                            {quoteError ? <div className="text-sm text-red-600 mt-2">{quoteError}</div> : null}
                            <button
                              type="button"
                              onClick={() => computeShippingQuote(c.supplier_id)}
                              disabled={quoteLoading || mutating || savingAddress || meLoading}
                              className={cn(
                                "mt-3 w-full px-5 py-3 rounded-xl font-bold text-sm",
                                quoteLoading || mutating || savingAddress || meLoading
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-primary text-white hover:bg-primary/90",
                              )}
                            >
                              {quoteLoading ? "Calculando..." : "Calcular Envío"}
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
                          {isActiveCheckout && visibleShippingNeedsQuote ? (
                            <div className="flex items-center justify-between gap-8 sm:justify-start">
                              <span>Envío</span>
                              <span className="font-bold text-gray-900">
                                {shippingCost != null && addressLocked ? money(shippingCost) : "Pendiente"}
                              </span>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-8 pt-2 sm:justify-start">
                            <span className="font-bold text-gray-900">Total estimado</span>
                            <span className="font-bold text-gray-900">{money(supplierTotal)}</span>
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
                          {mutating || savingAddress ? "Procesando..." : "Finalizar compra"}
                        </button>
                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {addressModalOpen && deliveryType === "shipping" && checkoutSupplierId != null ? (
        <div className="fixed inset-0 z-[90]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={async () => {
              if (addressModalSaving) return;
              if (addressDirtyRef.current) {
                addressDirtyRef.current = false;
                await reloadMeAddress();
              }
              setAddressModalOpen(false);
            }}
          />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Dirección de entrega</p>
                  <p className="font-bold text-gray-900 truncate">
                    {addressForm.address || userMapLocation ? "Puedes modificar tu dirección" : "Configura tu dirección para continuar"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (addressModalSaving) return;
                    if (addressDirtyRef.current) {
                      addressDirtyRef.current = false;
                      await reloadMeAddress();
                    }
                    setAddressModalOpen(false);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Calle</label>
                    <input
                      value={addressForm.address}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, address: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="Calle"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Número ext.</label>
                    <input
                      value={addressForm.exterior_number}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, exterior_number: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Número int.</label>
                    <input
                      value={addressForm.interior_number}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, interior_number: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="A"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">C.P.</label>
                    <input
                      value={addressForm.cp}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, cp: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="97000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Colonia</label>
                    <input
                      value={addressForm.neighborhood}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, neighborhood: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="Colonia"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Ciudad</label>
                    <input
                      value={addressForm.city}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, city: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="Mérida"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Estado</label>
                    <input
                      value={addressForm.state}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, state: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="Yucatán"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">País</label>
                    <input
                      value={addressForm.country}
                      onChange={(e) => {
                        addressDirtyRef.current = true;
                        setAddressForm((p) => ({ ...p, country: e.target.value }));
                        invalidateQuote();
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="México"
                    />
                  </div>
                </div>

                <GoogleMapPicker
                  location={userMapLocation}
                  readOnly={false}
                  onChange={(loc) => {
                    addressDirtyRef.current = true;
                    setUserMapLocation(loc);
                    invalidateQuote();
                  }}
                  height="320px"
                />

                {quoteError ? <div className="text-sm text-red-600">{quoteError}</div> : null}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (addressDirtyRef.current) {
                      addressDirtyRef.current = false;
                      await reloadMeAddress();
                    }
                    setAddressModalOpen(false);
                  }}
                  disabled={addressModalSaving}
                  className={cn(
                    "px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm",
                    addressModalSaving ? "opacity-50 cursor-not-allowed" : "",
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveAddressOnly()}
                  disabled={addressModalSaving || savingAddress}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90",
                    addressModalSaving || savingAddress ? "opacity-50 cursor-not-allowed" : "",
                  )}
                >
                  {addressModalSaving || savingAddress ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModal ? (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Pago</p>
                  <p className="font-bold text-gray-900 truncate">
                    Mercado Pago{paymentModal.order_id ? ` · Orden #${paymentModal.order_id}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPaymentModal(null);
                    window.dispatchEvent(new CustomEvent("cart:changed"));
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 bg-white">
                <iframe title="Mercado Pago" src={getSafeMercadoPagoUrl(paymentModal.init_point)} className="w-full h-full" />
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end">
                <a
                  href={getSafeMercadoPagoUrl(paymentModal.init_point)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-700 hover:underline"
                >
                  Abrir en otra pestaña
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
