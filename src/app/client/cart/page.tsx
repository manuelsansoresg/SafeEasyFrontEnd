"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import FileUpload from "@/components/ui/FileUpload";
import { orderService } from "@/services/orderService";
import {
  Loader2,
  Store,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  X,
  CreditCard,
  Landmark,
  ExternalLink,
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
  order_id: number;
  distance_km: number;
  init_point: string | null;
  transfer_bank: string | null;
  transfer_clabe: string | null;
  transfer_name: string | null;
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

function computeShipping(distanceKm: number) {
  const d = Number(distanceKm) || 0;
  const base = 20;
  const extraKm = Math.max(0, d - 2);
  const extra = 10 * extraKm;
  return base + extra;
}

export default function ClientCartPage() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const loadCart = async () => {
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

      if (!response || !response.ok) {
        setLines([]);
        setError("No se pudo cargar el carrito.");
        return;
      }

      const data: unknown = await response.json().catch(() => null);
      const record = (data && typeof data === "object" ? (data as Record<string, unknown>) : null) || null;
      const rawItems =
        (record && (record.items || record.results || record.lines || record.cart_items)) ||
        (Array.isArray(data) ? data : null);

      const list = Array.isArray(rawItems) ? rawItems : [];

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
    } catch {
      setLines([]);
      setError("Error de conexión al cargar el carrito.");
    } finally {
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

  const startCheckout = async (supplierId: number, supplierName: string) => {
    setMutating(true);
    setError(null);
    setStockError(null);
    setReceiptFile(null);
    try {
      const tryUrls = [
        `/api/cart/start-checkout/${supplierId}`,
        `/api/cart/start-checkout/${supplierId}/`,
        `/api/v1/cart/start-checkout/${supplierId}`,
        `/api/v1/cart/start-checkout/${supplierId}/`,
      ];
      let response: Response | null = null;
      for (const url of tryUrls) {
        response = await fetchWithAuth(url, { method: "POST" });
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405) break;
      }

      const data: unknown = await response?.json().catch(() => ({}));
      const record = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;

      if (!response || !response.ok) {
        const detail = record.detail;
        const message = record.message;
        const errorValue = record.error;
        const msg =
          (typeof detail === "string" && detail.trim()) ||
          (typeof message === "string" && message.trim()) ||
          (typeof errorValue === "string" && errorValue.trim()) ||
          "No se pudo iniciar el checkout.";
        setStockError(msg);
        await loadCart();
        return;
      }

      const orderIdRaw = record.order_id ?? record.id ?? record.orderId;
      const orderId = Number(orderIdRaw);
      if (!orderId || !Number.isFinite(orderId)) {
        setError("Checkout iniciado, pero no se recibió order_id.");
        await loadCart();
        return;
      }

      const distanceKm = Number(record.distance_km ?? record.distanceKm ?? record.distance ?? 0) || 0;
      const initPoint = typeof record.init_point === "string" ? record.init_point : null;

      const transferCandidate = record.transfer ?? record.supplier_transfer ?? record.supplier;
      const transfer =
        transferCandidate && typeof transferCandidate === "object"
          ? (transferCandidate as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const bankRaw = transfer.transfer_bank ?? record.transfer_bank ?? record.bank ?? null;
      const clabeRaw = transfer.transfer_clabe ?? record.transfer_clabe ?? record.clabe ?? null;
      const nameRaw = transfer.transfer_name ?? record.transfer_name ?? record.beneficiary ?? null;

      const bank = typeof bankRaw === "string" ? bankRaw : null;
      const clabe = typeof clabeRaw === "string" ? clabeRaw : null;
      const name = typeof nameRaw === "string" ? nameRaw : null;

      const productsSubtotalRaw = record.products_subtotal ?? record.subtotal ?? record.items_subtotal ?? null;
      const productsSubtotal =
        typeof productsSubtotalRaw === "number"
          ? productsSubtotalRaw
          : productsSubtotalRaw
            ? Number(String(productsSubtotalRaw).replace(/[^\d.-]/g, "")) || getSupplierSubtotal(supplierId)
            : getSupplierSubtotal(supplierId);

      setCheckout({
        supplier_id: supplierId,
        supplier_name: supplierName,
        order_id: orderId,
        distance_km: distanceKm,
        init_point: initPoint,
        transfer_bank: bank,
        transfer_clabe: clabe,
        transfer_name: name,
        products_subtotal: productsSubtotal,
      });

      await loadCart();
    } catch {
      setError("Error de conexión al iniciar el checkout.");
    } finally {
      setMutating(false);
    }
  };

  const uploadReceipt = async () => {
    if (!checkout) return;
    if (!receiptFile) return;
    setUploadingReceipt(true);
    setError(null);
    try {
      await orderService.uploadOrderReceipt(checkout.order_id, receiptFile);
      setCheckout(null);
      setReceiptFile(null);
      await loadCart();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el comprobante.");
    } finally {
      setUploadingReceipt(false);
    }
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
                    onClick={() => startCheckout(g.supplier_id, g.supplier_name)}
                    disabled={mutating}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-colors",
                      mutating ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90"
                    )}
                  >
                    {mutating ? <Loader2 size={16} className="animate-spin" /> : null}
                    Proceder al Pago
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
                <div className="flex items-center justify-between text-sm text-gray-700 mt-2">
                  <span>Envío</span>
                  <span className="font-semibold text-gray-900">{money(computeShipping(checkout.distance_km))}</span>
                </div>
                <div className="h-px bg-gray-200 my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">
                    {money(checkout.products_subtotal + computeShipping(checkout.distance_km))}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Envío: $20 base + $10 por km extra arriba de 2km (distancia: {checkout.distance_km.toFixed(2)} km)
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-900">Método de pago</p>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-primary" />
                    <p className="font-semibold text-gray-900">Tarjeta</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Paga con Mercado Pago.</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkout.init_point) return;
                      window.open(checkout.init_point, "_blank", "noopener,noreferrer");
                      setCheckout(null);
                      setReceiptFile(null);
                      loadCart();
                    }}
                    disabled={!checkout.init_point}
                    className={cn(
                      "mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm",
                      checkout.init_point ? "bg-primary text-white hover:bg-primary/90" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <ExternalLink size={16} />
                    Ir a pagar
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <Landmark size={18} className="text-primary" />
                    <p className="font-semibold text-gray-900">Transferencia</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Sube tu comprobante para validación.</p>

                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">Banco</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {checkout.transfer_bank || "No especificado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">Beneficiario</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {checkout.transfer_name || "No especificado"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-gray-500 mt-0.5">CLABE</span>
                      <span className="font-mono font-bold text-gray-900 text-right break-all">
                        {checkout.transfer_clabe || "No especificada"}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 pt-2">
                      Concepto/Referencia: <span className="font-mono font-bold">{checkout.order_id}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <FileUpload
                      label="Comprobante"
                      value={receiptFile}
                      onChange={setReceiptFile}
                      accept="image/*,application/pdf"
                      helperText="Adjunta imagen o PDF"
                      disabled={uploadingReceipt}
                      removeBehavior="clear_selection"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={uploadReceipt}
                    disabled={!receiptFile || uploadingReceipt}
                    className={cn(
                      "mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm",
                      !receiptFile || uploadingReceipt
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#168e00] text-white hover:bg-[#137500]"
                    )}
                  >
                    {uploadingReceipt ? <Loader2 size={16} className="animate-spin" /> : null}
                    Subir comprobante
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
