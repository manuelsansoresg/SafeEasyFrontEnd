"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { CheckCircle2, Loader2, Minus, Plus, ShieldCheck, Store, Trash2 } from "lucide-react";

type ProductLite = {
  id: string;
  title: string;
  sku?: string | null;
  price?: number | string | null;
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
  supplier_name: string;
  supplier_is_verified: boolean;
  items: CartItem[];
};

type ToastState = null | { type: "success" | "error" | "info"; message: string };

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
        product = {
          id: String(productCandidate.id ?? productId),
          title: String(productCandidate.title ?? item.title ?? "Producto"),
          sku: typeof productCandidate.sku === "string" ? productCandidate.sku : typeof item.sku === "string" ? item.sku : null,
          price: typeof priceRaw === "number" || typeof priceRaw === "string" ? priceRaw : null,
          image: typeof productCandidate.image === "string" ? productCandidate.image : null,
          thumbnail_url: typeof productCandidate.thumbnail_url === "string" ? productCandidate.thumbnail_url : null,
        };
      } else {
        const title = String(item.title ?? "Producto");
        const priceRaw = item.price ?? null;
        product = {
          id: productId,
          title,
          sku: typeof item.sku === "string" ? item.sku : null,
          price: typeof priceRaw === "number" || typeof priceRaw === "string" ? priceRaw : null,
          image: null,
          thumbnail_url: null,
        };
      }

      items.push({ id: itemId, product_id: productId, quantity, supplier_id: supplierId, product });
    }

    if (items.length === 0) continue;
    carts.push({ supplier_id: supplierId, supplier_name: supplierName, supplier_is_verified: supplierIsVerified, items });
  }

  return carts;
}

export default function CartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [carts, setCarts] = useState<SupplierCart[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const prevSnapshot = useRef<SupplierCart[] | null>(null);

  const closeToast = () => setToast(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await tryFetch(["/api/cart/", "/api/cart", "/api/v1/cart/", "/api/v1/cart"]);
      if (!res || !res.ok) {
        setCarts([]);
        setToast({ type: "error", message: "No se pudo cargar el carrito." });
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      const parsed = parseSupplierCarts(data);
      setCarts(parsed);
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {
      setCarts([]);
      setToast({ type: "error", message: "Error de conexión al cargar el carrito." });
    } finally {
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

  const globalSubtotal = useMemo(() => {
    return carts.reduce((sum, c) => {
      return (
        sum +
        c.items.reduce((s, it) => {
          const priceRaw = it.product?.price ?? 0;
          const price = typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;
          return s + price * (Number(it.quantity) || 0);
        }, 0)
      );
    }, 0);
  }, [carts]);

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
        ["/api/cart/update", "/api/cart/update/", "/api/v1/cart/update", "/api/v1/cart/update/"],
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
        [`/api/cart/item/${itemId}`, `/api/cart/item/${itemId}/`, `/api/v1/cart/item/${itemId}`, `/api/v1/cart/item/${itemId}/`],
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
          `/api/v1/cart/clear/${supplierId}`,
          `/api/v1/cart/clear/${supplierId}/`,
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

  const startCheckout = async (supplierId: number) => {
    setMutating(true);
    try {
      const res = await tryFetch(
        [
          `/api/cart/start-checkout/${supplierId}`,
          `/api/cart/start-checkout/${supplierId}/`,
          `/api/v1/cart/start-checkout/${supplierId}`,
          `/api/v1/cart/start-checkout/${supplierId}/`,
        ],
        { method: "POST" },
      );
      if (!res || !res.ok) {
        const text = await res?.text().catch(() => "") ?? "";
        setToast({ type: "error", message: text.trim() || "No se pudo iniciar el checkout." });
        await load();
        return;
      }

      const data: unknown = await res.json().catch(() => ({}));
      const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const orderId = Number(record.order_id ?? record.id ?? record.orderId ?? 0);
      if (!orderId) {
        setToast({ type: "error", message: "Checkout iniciado, pero no se recibió order_id." });
        return;
      }
      window.dispatchEvent(new CustomEvent("cart:changed"));
      router.push(`/checkout/${orderId}`);
    } catch {
      setToast({ type: "error", message: "Error de conexión al iniciar el checkout." });
    } finally {
      setMutating(false);
    }
  };

  const isEmpty = !loading && carts.length === 0;

  return (
    <div className="min-h-[calc(100vh-6rem)] pt-24 md:pt-28 pb-16 font-[family-name:var(--font-poppins)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Store size={22} className="text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Carrito</h1>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Seguir comprando
          </Link>
        </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {carts.map((c) => {
                const supplierSubtotal = c.items.reduce((sum, it) => {
                  const priceRaw = it.product?.price ?? 0;
                  const price =
                    typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;
                  return sum + price * (Number(it.quantity) || 0);
                }, 0);

                return (
                  <div key={c.supplier_id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{c.supplier_name}</p>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1 border",
                              c.supplier_is_verified
                                ? "border-[#168e00]/20 bg-[#168e00]/10 text-[#168e00]"
                                : "border-gray-200 bg-gray-50 text-gray-500",
                            )}
                          >
                            <ShieldCheck size={14} />
                            Tienda verificada
                          </span>
                        </div>
                      </div>
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

                    <div className="divide-y divide-gray-100">
                      {c.items.map((it) => {
                        const img = it.product?.thumbnail_url || it.product?.image || null;
                        const priceRaw = it.product?.price ?? 0;
                        const price =
                          typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[^\d.-]/g, "")) || 0;
                        const lineTotal = price * (Number(it.quantity) || 0);
                        const sku = String(it.product?.sku || "").trim();

                        return (
                          <div key={it.id} className="px-5 py-4 flex gap-4 items-start">
                            <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shrink-0">
                              <img src={buildImageUrl(img)} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{it.product?.title || "Producto"}</p>
                              {sku ? <p className="text-xs text-gray-500 mt-0.5">SKU: {sku}</p> : null}
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

                    <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        Subtotal: <span className="font-bold text-gray-900">{money(supplierSubtotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCheckout(c.supplier_id)}
                        disabled={mutating}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-colors",
                          mutating ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90",
                        )}
                      >
                        {mutating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Finalizar compra con {c.supplier_name}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 h-fit sticky top-28">
              <p className="text-sm font-bold text-gray-900">Resumen</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span>Subtotal productos</span>
                  <span className="font-semibold text-gray-900">{money(globalSubtotal)}</span>
                </div>
                <div className="h-px bg-gray-100 my-3" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Total estimado</span>
                  <span className="font-bold text-gray-900">{money(globalSubtotal)}</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Cada proveedor se paga por separado. El envío se calcula en el checkout de cada tienda.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
