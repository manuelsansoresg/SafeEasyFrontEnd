"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  menuCartKey,
  menuCartQuantity,
  menuCartSubtotal,
  menuLineKey,
  useMenuCartHydrated,
  useMenuCartStore,
} from "@/store/useMenuCartStore";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function MenuCartSection() {
  const hydrated = useMenuCartHydrated();
  const carts = useMenuCartStore((state) => state.carts);
  const changeQuantity = useMenuCartStore((state) => state.changeQuantity);
  const updateNotes = useMenuCartStore((state) => state.updateNotes);
  const removeItem = useMenuCartStore((state) => state.removeItem);
  const clearCart = useMenuCartStore((state) => state.clearCart);
  const visibleCarts = hydrated ? Object.values(carts) : [];

  return (
    <section aria-labelledby="menu-cart-heading" className="space-y-5">
      <div className="border-t border-[#004e28]/10 pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">Pedidos por restaurante</p>
        <h2 id="menu-cart-heading" className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">Menú</h2>
        <p className="mt-1 text-sm text-gray-600">Cada restaurante se revisa y paga por separado. El envío se calcula al finalizar cada pedido.</p>
      </div>
      {visibleCarts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-600">
          <ShoppingBag className="mx-auto mb-3 text-[#168e00]" size={30} />
          Aún no tienes platillos en el carrito.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleCarts.map((cart) => {
            const key = menuCartKey(cart.supplierId, cart.menuId);
            const quantity = menuCartQuantity(cart);
            const href = `/empresas/${encodeURIComponent(cart.supplierSlug)}/menu/?menuCart=${cart.menuId}`;
            return (
              <article key={key} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#004e28]/15 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-[#f2f3f4] px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#168e00]">Restaurante · {quantity} {quantity === 1 ? "platillo" : "platillos"}</p>
                  <h3 className="mt-1 font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]">{cart.supplierName}</h3>
                  <p className="text-xs text-gray-600">{cart.menuName}</p>
                </div>
                <div className="flex-1 divide-y divide-gray-100 px-5">
                  {Object.entries(cart.items).map(([lineKey, line]) => (
                    <div key={lineKey} className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{line.item.name}</p>
                          {line.variant ? <p className="text-xs text-gray-500">{line.variant.name}</p> : null}
                          <p className="mt-1 text-sm font-bold text-[#004e28]">{money.format(Number(line.variant?.price ?? line.item.price ?? 0) * line.quantity)}</p>
                        </div>
                        <button type="button" onClick={() => removeItem(key, lineKey)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Eliminar ${line.item.name}`}><Trash2 size={17} /></button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200">
                          <button type="button" onClick={() => changeQuantity(cart, line.item, line.variant, -1)} className="flex h-9 w-9 items-center justify-center hover:bg-gray-50" aria-label={`Quitar uno de ${line.item.name}`}><Minus size={15} /></button>
                          <span className="min-w-8 text-center text-sm font-bold">{line.quantity}</span>
                          <button type="button" onClick={() => changeQuantity(cart, line.item, line.variant, 1)} disabled={line.quantity >= 99} className="flex h-9 w-9 items-center justify-center bg-[#168e00] text-white disabled:opacity-40" aria-label={`Agregar uno de ${line.item.name}`}><Plus size={15} /></button>
                        </div>
                        <span className="text-xs text-gray-500">Cantidad</span>
                      </div>
                      <label className="mt-3 block text-xs font-semibold text-gray-600">
                        Nota para este platillo
                        <textarea value={line.notes} maxLength={500} onChange={(event) => updateNotes(key, menuLineKey(line.item.id, line.variant?.id), event.target.value)} placeholder="Ej. sin cebolla" className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-800 outline-none focus:border-[#168e00]" rows={2} />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-gray-100 px-5 py-4">
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Subtotal</span><strong className="text-[#004e28]">{money.format(menuCartSubtotal(cart))}</strong></div>
                  <p className="text-xs text-gray-500">Recoger o envío, dirección y pago se eligen al finalizar.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={href} className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#168e00] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#117500]">Revisar y finalizar pedido</Link>
                    <button type="button" onClick={() => clearCart(key)} className="rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">Vaciar</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
