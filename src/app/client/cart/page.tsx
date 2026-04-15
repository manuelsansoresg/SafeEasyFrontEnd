"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { distanceKmDriving, LatLngLiteral, parseMapLocation } from "@/lib/googleMaps";
import {
  Loader2,
  Store,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  X,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

type CartLine = {
  supplier_id: number;
  supplier_name: string;
  product_id: string;
  title: string;
  image: string | null;
  price: number;
  quantity: number;
};

type CheckoutState = {
  supplier_id: number;
  supplier_name: string;
  products_subtotal: number;
};

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

export default function ClientCartPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const isUnmountedRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const addressDirtyRef = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState<"card" | "transfer">("card");
  const [paymentModal, setPaymentModal] = useState<null | { init_point: string; order_id: number | null }>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "shipping">("pickup");
  const [meUserId, setMeUserId] = useState<number | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [addressForm, setAddressForm] = useState({
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
  const [supplierLocById, setSupplierLocById] = useState<Record<number, LatLngLiteral>>({});
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [addressLocked, setAddressLocked] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalSaving, setAddressModalSaving] = useState(false);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
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

        const idFromMe = Number(src.id ?? rec.id ?? 0);
        if (Number.isFinite(idFromMe) && idFromMe > 0) setMeUserId(idFromMe);
        const loc = parseMapLocation(src.map_location ?? rec.map_location ?? null);
        if (!addressDirtyRef.current) {
          setAddressForm({
            address: String(src.address || src.street || rec.address || rec.street || "").trim(),
            exterior_number: String(src.exterior_number || src.outdoor_number || rec.exterior_number || rec.outdoor_number || "").trim(),
            interior_number: String(src.interior_number || src.indoor_number || rec.interior_number || rec.indoor_number || "").trim(),
            cp: String(src.cp || src.zip_code || src.postal_code || rec.cp || rec.zip_code || rec.postal_code || "").trim(),
            neighborhood: String(src.neighborhood || src.colonia || rec.neighborhood || rec.colonia || "").trim(),
            city: String(src.city || rec.city || "Mérida"),
            state: String(src.state || rec.state || "Yucatán"),
            country: String(src.country || rec.country || "México"),
          });
          if (loc) setUserMapLocation(loc);
        } else if (!userMapLocation && loc) {
          setUserMapLocation(loc);
        }
      } catch {}
      finally {
        setMeLoading(false);
      }
    };
    loadMe();
  }, [token]);

  const reloadMeAddress = async () => {
    if (!token) return;
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

      const idFromMe = Number(src.id ?? rec.id ?? 0);
      if (Number.isFinite(idFromMe) && idFromMe > 0) setMeUserId(idFromMe);
      const loc = parseMapLocation(src.map_location ?? rec.map_location ?? null);
      setAddressForm({
        address: String(src.address || src.street || rec.address || rec.street || "").trim(),
        exterior_number: String(src.exterior_number || src.outdoor_number || rec.exterior_number || rec.outdoor_number || "").trim(),
        interior_number: String(src.interior_number || src.indoor_number || rec.interior_number || rec.indoor_number || "").trim(),
        cp: String(src.cp || src.zip_code || src.postal_code || rec.cp || rec.zip_code || rec.postal_code || "").trim(),
        neighborhood: String(src.neighborhood || src.colonia || rec.neighborhood || rec.colonia || "").trim(),
        city: String(src.city || rec.city || "Mérida"),
        state: String(src.state || rec.state || "Yucatán"),
        country: String(src.country || rec.country || "México"),
      });
      if (loc) setUserMapLocation(loc);
    } catch {}
    finally {
      setMeLoading(false);
    }
  };

  useEffect(() => {
    const id = Number(user?.id ?? 0);
    if (Number.isFinite(id) && id > 0) setMeUserId(id);
  }, [user?.id]);

  const loadCart = async () => {
    if (isRedirectingRef.current || isUnmountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const tryUrls = ["/api/cart", "/api/cart/", "/api/v1/cart", "/api/v1/cart/"];
      let response: Response | null = null;
      for (const url of tryUrls) {
        response = await fetchWithAuth(url);
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405) break;
      }

      if (response && (response.status === 401 || response.status === 403)) {
        await new Promise<void>((r) => window.setTimeout(() => r(), 250));
        for (const url of tryUrls) {
          response = await fetchWithAuth(url);
          if (response.ok) break;
          if (response.status !== 404 && response.status !== 405) break;
        }
      }

      if (!response || !response.ok) {
        if (isRedirectingRef.current || isUnmountedRef.current) return;
        setLines([]);
        setError("No se pudo cargar el carrito.");
        return;
      }

      const data: unknown = await response.json().catch(() => null);
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      const record = (data && typeof data === "object" ? (data as Record<string, unknown>) : null) || null;
      const rawItems =
        (record && (record.items || record.results || record.lines || record.cart_items)) ||
        (Array.isArray(data) ? data : null);

      const list = Array.isArray(rawItems) ? rawItems : [];
      const nextSupplierLocById: Record<number, LatLngLiteral> = {};

      const parsed: CartLine[] = list
        .map((row) => {
          const r = (row && typeof row === "object" ? (row as Record<string, unknown>) : {}) as Record<string, unknown>;
          const product =
            (r.product && typeof r.product === "object" ? (r.product as Record<string, unknown>) : null) ||
            (r.product_detail && typeof r.product_detail === "object"
              ? (r.product_detail as Record<string, unknown>)
              : null) ||
            (r.item && typeof r.item === "object" ? (r.item as Record<string, unknown>) : null) ||
            {};

          const supplier =
            (r.supplier && typeof r.supplier === "object" ? (r.supplier as Record<string, unknown>) : null) ||
            (product.supplier && typeof product.supplier === "object" ? (product.supplier as Record<string, unknown>) : null) ||
            {};

          const supplierIdRaw = r.supplier_id ?? product.supplier_id ?? supplier.id;
          const supplierId = Number(supplierIdRaw);
          const supplierMapLoc = parseMapLocation(
            r.supplier_map_location ?? r.supplierLocation ?? r.map_location ?? supplier.map_location ?? supplier.location ?? null,
          );
          if (supplierId && supplierMapLoc) nextSupplierLocById[supplierId] = supplierMapLoc;
          const supplierName =
            String(r.supplier_name || supplier.name || supplier.company_name || "").trim() || `Proveedor #${supplierId}`;

          const productId = (r.product_id ?? product.id ?? "").toString();
          const title = String(r.title || product.title || "").trim() || "Producto";
          const image = (r.image || product.thumbnail_url || product.image || null) as string | null;

          const priceRaw = r.price ?? product.price ?? 0;
          const price = typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;

          const qtyRaw = r.quantity ?? r.qty ?? r.amount ?? 1;
          const quantity = Math.max(1, Number(qtyRaw) || 1);

          if (!supplierId || !productId) return null;
          return { supplier_id: supplierId, supplier_name: supplierName, product_id: productId, title, image, price, quantity };
        })
        .filter((v): v is CartLine => !!v);

      setLines(parsed);
      setSupplierLocById(nextSupplierLocById);
    } catch {
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      setLines([]);
      setError("Error de conexión al cargar el carrito.");
    } finally {
      if (isRedirectingRef.current || isUnmountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadCart();
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onFocus = () => loadCart();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadCart();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const groups = useMemo(() => {
    const bySupplier = new Map<number, { supplier_id: number; supplier_name: string; items: CartLine[] }>();
    for (const line of lines) {
      const current = bySupplier.get(line.supplier_id);
      if (current) {
        current.items.push(line);
      } else {
        bySupplier.set(line.supplier_id, { supplier_id: line.supplier_id, supplier_name: line.supplier_name, items: [line] });
      }
    }
    return Array.from(bySupplier.values());
  }, [lines]);

  const getSupplierSubtotal = (supplierId: number) => {
    return lines
      .filter((l) => l.supplier_id === supplierId)
      .reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);
  };

  const invalidateQuote = () => {
    setQuoteError(null);
    setShippingCost(null);
    setDistanceKm(null);
    setAddressLocked(false);
  };

  const updateQuantity = async (supplierId: number, productId: string, nextQty: number) => {
    const quantity = Math.max(1, Math.floor(nextQty));
    setMutating(true);
    try {
      const payload = { product_id: productId, quantity, supplier_id: supplierId };
      const options = { method: "PATCH", body: JSON.stringify(payload) };
      const tryUrls = ["/api/cart/update", "/api/cart/update/", "/api/v1/cart/update", "/api/v1/cart/update/"];
      let response: Response | null = null;
      for (const url of tryUrls) {
        response = await fetchWithAuth(url, options);
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405) break;
      }
      if (!response || !response.ok) {
        setError("No se pudo actualizar la cantidad.");
        return;
      }
      await loadCart();
    } catch {
      setError("Error de conexión al actualizar la cantidad.");
    } finally {
      setMutating(false);
    }
  };

  const clearSupplierCart = async (supplierId: number) => {
    setMutating(true);
    setError(null);
    try {
      const tryUrls = [
        `/api/cart/clear/${supplierId}`,
        `/api/cart/clear/${supplierId}/`,
        `/api/v1/cart/clear/${supplierId}`,
        `/api/v1/cart/clear/${supplierId}/`,
      ];
      let response: Response | null = null;
      for (const url of tryUrls) {
        response = await fetchWithAuth(url, { method: "DELETE" });
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405) break;
      }
      if (!response || !response.ok) {
        setError("No se pudo eliminar el carrito de este proveedor.");
        return;
      }
      await loadCart();
    } catch {
      setError("Error de conexión al eliminar el carrito del proveedor.");
    } finally {
      setMutating(false);
    }
  };

  const saveAddress = async () => {
    if (!meUserId) return true;
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
    if (userMapLocation) body.map_location = JSON.stringify(userMapLocation);
    const res = await fetchWithAuth(`/api/users/${meUserId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { Accept: "application/json" },
    });
    return res.ok;
  };

  const confirmAndPay = async (supplierId: number) => {
    setMutating(true);
    setError(null);
    setStockError(null);
    try {
      const items = lines
        .filter((l) => Number(l.supplier_id) === Number(supplierId))
        .map((l) => ({ product_id: String(l.product_id || "").trim(), quantity: Number(l.quantity) || 0 }))
        .filter((it) => it.product_id && it.quantity > 0);

      if (!items.length) {
        setError("No hay productos válidos para iniciar el checkout.");
        return;
      }

      if (deliveryType === "shipping") {
        if (!userMapLocation) {
          setError("Selecciona tu ubicación para el envío.");
          return;
        }
        if (shippingCost == null) {
          setError("Primero calcula el costo de envío.");
          return;
        }
        const saved = await saveAddress();
        if (!saved) {
          setError("No se pudo guardar tu dirección.");
          return;
        }
      }

      const tryUrls = ["/api/orders/checkout", "/api/orders/checkout/", "/api/v1/orders/checkout", "/api/v1/orders/checkout/"];
      const payload: Record<string, unknown> = {
        items,
        delivery_type: deliveryType,
        payment_method: paymentMethod,
        distance_km: 0,
        courier_user_id: 0,
      };
      if (deliveryType === "shipping" && distanceKm != null && Number.isFinite(distanceKm)) payload.distance_km = distanceKm;

      let response: Response | null = null;
      for (const url of tryUrls) {
        response = await fetchWithAuth(url, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { Accept: "application/json" },
        });
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405) break;
      }

      const data: unknown = await response?.json().catch(() => ({}));
      const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

      if (!response || !response.ok) {
        const msg =
          (typeof record.detail === "string" && record.detail.trim()) ||
          (typeof record.message === "string" && record.message.trim()) ||
          (typeof record.error === "string" && record.error.trim()) ||
          "No se pudo iniciar el checkout.";
        const lower = msg.toLowerCase();
        if (lower.includes("stock") || lower.includes("invent") || lower.includes("insuf")) {
          setStockError(msg);
        } else {
          setError(msg);
        }
        await loadCart();
        return;
      }

      const orderObj = record.order && typeof record.order === "object" ? (record.order as Record<string, unknown>) : null;
      const nestedId = orderObj ? orderObj.id : null;
      const orderId = Number(record.order_id ?? record.id ?? record.orderId ?? nestedId ?? 0);
      try {
        if (orderId) {
          const key = `drooopy:checkout:${orderId}`;
          sessionStorage.setItem(key, JSON.stringify(data));
        }
      } catch {}

      const preferenceObj = record.preference && typeof record.preference === "object" ? (record.preference as Record<string, unknown>) : null;
      const initPoint =
        (preferenceObj && typeof preferenceObj.init_point === "string" ? preferenceObj.init_point : null) ||
        (typeof record.init_point === "string" ? record.init_point : null);
      if (initPoint) {
        setCheckout(null);
        setPaymentModal({ init_point: initPoint, order_id: orderId || null });
        return;
      }

      await loadCart();
      if (orderId) router.push(`/checkout/${orderId}`);
    } catch {
      setError("Error de conexión al iniciar el checkout.");
    } finally {
      setMutating(false);
    }
  };

  const saveAddressOnly = async () => {
    setQuoteError(null);
    if (!userMapLocation) {
      setQuoteError("Selecciona tu ubicación en el mapa.");
      return;
    }
    setAddressModalSaving(true);
    try {
      const saved = await saveAddress();
      if (!saved) {
        setQuoteError("No se pudo guardar tu dirección.");
        return;
      }
      addressDirtyRef.current = false;
      setAddressModalOpen(false);
      if (deliveryType === "shipping" && checkout) {
        window.setTimeout(() => {
          computeShippingQuote(checkout.supplier_id, true).catch(() => {});
        }, 0);
      }
    } finally {
      setAddressModalSaving(false);
    }
  };

  const computeShippingQuote = async (supplierId: number, force?: boolean) => {
    setQuoteError(null);
    if (!force && deliveryType !== "shipping") return;

    if (!userMapLocation || addressDirtyRef.current) {
      setAddressModalOpen(true);
      return;
    }

    const sLoc = supplierLocById[supplierId] ?? null;
    if (!sLoc) {
      setQuoteError("No se pudo obtener la ubicación del proveedor.");
      return;
    }

    setQuoteLoading(true);
    try {
      const km = await distanceKmDriving(userMapLocation, sLoc);
      setDistanceKm(km);

      const tryUrls = ["/api/cart/shipping-quote", "/api/cart/shipping-quote/", "/api/v1/cart/shipping-quote", "/api/v1/cart/shipping-quote/"];
      let res: Response | null = null;
      for (const url of tryUrls) {
        res = await fetchWithAuth(url, {
          method: "POST",
          body: JSON.stringify({ supplier_id: supplierId, distance_km: km }),
          headers: { Accept: "application/json" },
        });
        if (res.ok) break;
        if (res.status !== 404 && res.status !== 405) break;
      }

      if (!res) {
        setQuoteError("No se pudo cotizar el envío.");
        setShippingCost(null);
        return;
      }
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const msg =
          (typeof rec.detail === "string" && rec.detail) ||
          (typeof rec.message === "string" && rec.message) ||
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

  const handlePrimaryAction = async (supplierId: number) => {
    if (deliveryType === "shipping" && !addressLocked) {
      await computeShippingQuote(supplierId);
      return;
    }
    await confirmAndPay(supplierId);
  };

  const startCheckout = async (supplierId: number) => {
    setError(null);
    setStockError(null);
    invalidateQuote();
    setPaymentMethod("card");
    setDeliveryType("pickup");
    const g = groups.find((x) => x.supplier_id === supplierId) || null;
    setCheckout({
      supplier_id: supplierId,
      supplier_name: g?.supplier_name || "Proveedor",
      products_subtotal: getSupplierSubtotal(supplierId),
    });
  };

  const hasItems = lines.length > 0;

  return (
    <div className="font-[family-name:var(--font-poppins)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart size={22} className="text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Mi Carrito</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          Seguir comprando
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando carrito...
        </div>
      ) : !hasItems ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-600">
          <div className="mx-auto w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <ShoppingCart className="text-gray-400" size={26} />
          </div>
          <p className="font-semibold text-gray-900">Tu carrito está vacío</p>
          <p className="text-sm text-gray-500 mt-1">Agrega productos para comenzar el checkout.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const subtotal = getSupplierSubtotal(g.supplier_id);
            return (
              <div key={g.supplier_id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Store size={18} className="text-gray-500 shrink-0" />
                    <h2 className="font-bold text-gray-900 truncate">{g.supplier_name}</h2>
                  </div>
                  <button
                    onClick={() => clearSupplierCart(g.supplier_id)}
                    disabled={mutating}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    Eliminar carrito
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {g.items.map((item) => {
                    const lineSubtotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                    return (
                      <div key={`${g.supplier_id}:${item.product_id}`} className="px-5 py-4 flex gap-4 items-start">
                        <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={buildImageUrl(item.image)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{money(item.price)}</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(g.supplier_id, item.product_id, item.quantity - 1)}
                                disabled={mutating || item.quantity <= 1}
                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Disminuir cantidad"
                              >
                                <Minus size={16} />
                              </button>
                              <div className="w-12 h-10 flex items-center justify-center font-semibold text-gray-900">
                                {item.quantity}
                              </div>
                              <button
                                type="button"
                                onClick={() => updateQuantity(g.supplier_id, item.product_id, item.quantity + 1)}
                                disabled={mutating}
                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Aumentar cantidad"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                            <div className="font-bold text-gray-900">{money(lineSubtotal)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    Subtotal tienda: <span className="font-bold text-gray-900">{money(subtotal)}</span>
                  </div>
                  <button
                    onClick={() => startCheckout(g.supplier_id)}
                    disabled={mutating}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-colors border",
                      mutating
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200"
                        : "bg-white text-primary border-primary hover:bg-primary/5"
                    )}
                  >
                    {mutating ? <Loader2 size={16} className="animate-spin" /> : null}
                    Finalizar compra
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stockError && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <p className="font-bold text-gray-900">Stock insuficiente</p>
              </div>
              <button onClick={() => setStockError(null)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 text-sm text-gray-700">{stockError}</div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => {
                  setStockError(null);
                  loadCart();
                }}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold text-sm hover:bg-black"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {checkout && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCheckout(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Checkout</p>
                <p className="font-bold text-gray-900 truncate">{checkout.supplier_name}</p>
              </div>
              <button onClick={() => setCheckout(null)} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span>Subtotal productos</span>
                  <span className="font-semibold text-gray-900">{money(checkout.products_subtotal)}</span>
                </div>
                {deliveryType === "shipping" ? (
                  <div className="flex items-center justify-between text-sm text-gray-700 mt-2">
                    <span>Envío</span>
                    <span className="font-semibold text-gray-900">
                      {shippingCost != null && addressLocked ? money(shippingCost) : "—"}
                    </span>
                  </div>
                ) : null}
                <div className="h-px bg-gray-200 my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">
                    {money(checkout.products_subtotal + (deliveryType === "shipping" && shippingCost != null && addressLocked ? shippingCost : 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-900">Método de entrega</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryType("pickup");
                      invalidateQuote();
                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-semibold",
                      deliveryType === "pickup" ? "border-primary text-primary" : "border-gray-200 text-gray-700"
                    )}
                  >
                    Recojo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryType("shipping");
                      invalidateQuote();
                      if (checkout) computeShippingQuote(checkout.supplier_id, true).catch(() => {});
                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-semibold",
                      deliveryType === "shipping" ? "border-primary text-primary" : "border-gray-200 text-gray-700"
                    )}
                  >
                    Envío
                  </button>
                </div>
              </div>

              {deliveryType === "shipping" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">Dirección de entrega</p>
                    <button
                      type="button"
                      onClick={async () => {
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

                  {quoteError ? <div className="text-sm text-red-600">{quoteError}</div> : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-900">Método de pago</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-2",
                      paymentMethod === "card" ? "border-primary text-primary" : "border-gray-200 text-gray-700"
                    )}
                  >
                    <CreditCard size={16} />
                    Tarjeta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transfer")}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-semibold",
                      paymentMethod === "transfer" ? "border-primary text-primary" : "border-gray-200 text-gray-700"
                    )}
                  >
                    Transferencia
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckout(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handlePrimaryAction(checkout.supplier_id)}
                  disabled={
                    mutating ||
                    quoteLoading ||
                    meLoading ||
                    (deliveryType === "shipping" && addressLocked && shippingCost == null)
                  }
                  className={cn(
                    "px-5 py-3 rounded-xl font-bold text-sm",
                    mutating || quoteLoading ? "bg-gray-200 text-gray-400" : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {quoteLoading
                    ? "Calculando..."
                    : deliveryType === "shipping" && !addressLocked
                      ? "Calcular costo de envío"
                      : mutating
                        ? "Procesando..."
                        : "Confirmar y pagar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkout && addressModalOpen && deliveryType === "shipping" ? (
        <div className="fixed inset-0 z-[75]">
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
                  addressContext={{
                    street: addressForm.address,
                    exteriorNumber: addressForm.exterior_number,
                    neighborhood: addressForm.neighborhood,
                    postalCode: addressForm.cp,
                    city: addressForm.city,
                    state: addressForm.state,
                    country: addressForm.country,
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
                  disabled={addressModalSaving || meLoading}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90",
                    addressModalSaving || meLoading ? "opacity-50 cursor-not-allowed" : "",
                  )}
                >
                  {addressModalSaving ? "Guardando..." : "Guardar"}
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
                    loadCart();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 bg-white">
                <iframe title="Mercado Pago" src={paymentModal.init_point} className="w-full h-full" />
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end">
                <a
                  href={paymentModal.init_point}
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
    </div>
  );
}
