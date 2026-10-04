import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MenuItem, MenuItemVariant } from "@/types/menu";

export type MenuCartLine = {
  item: MenuItem;
  variant: MenuItemVariant | null;
  quantity: number;
  notes: string;
};

export type MenuSupplierCart = {
  supplierId: number;
  supplierSlug: string;
  supplierName: string;
  menuId: number;
  menuName: string;
  items: Record<string, MenuCartLine>;
};

type MenuCartIdentity = Omit<MenuSupplierCart, "items">;

type MenuCartState = {
  carts: Record<string, MenuSupplierCart>;
  changeQuantity: (identity: MenuCartIdentity, item: MenuItem, variant: MenuItemVariant | null, delta: number) => void;
  updateNotes: (cartKey: string, lineKey: string, notes: string) => void;
  removeItem: (cartKey: string, lineKey: string) => void;
  clearCart: (cartKey: string) => void;
  clearSupplierCart: (supplierId: number) => void;
  clearAllMenuCarts: () => void;
  getSupplierCart: (supplierId: number, menuId: number) => MenuSupplierCart | undefined;
  getTotalMenuItems: () => number;
};

export const menuCartKey = (supplierId: number, menuId: number) => `${supplierId}:${menuId}`;
export const menuLineKey = (itemId: number, variantId?: number | null) => `${itemId}:${variantId ?? "base"}`;
export const menuCartQuantity = (cart: MenuSupplierCart) =>
  Object.values(cart.items).reduce((sum, line) => sum + line.quantity, 0);
export const menuCartSubtotal = (cart: MenuSupplierCart) =>
  Object.values(cart.items).reduce(
    (sum, line) => sum + Number(line.variant?.price ?? line.item.price ?? 0) * line.quantity,
    0,
  );

export const useMenuCartStore = create<MenuCartState>()(
  persist(
    (set, get) => ({
      carts: {},
      changeQuantity: (identity, item, variant, delta) => set((state) => {
        const key = menuCartKey(identity.supplierId, identity.menuId);
        const current = state.carts[key];
        const lineKey = menuLineKey(item.id, variant?.id);
        const existing = current?.items[lineKey];
        const quantity = Math.max(0, Math.min(99, (existing?.quantity ?? 0) + delta));
        const items = { ...current?.items };
        if (quantity === 0) delete items[lineKey];
        else items[lineKey] = { item, variant, quantity, notes: existing?.notes ?? "" };
        const carts = { ...state.carts };
        if (Object.keys(items).length) carts[key] = { ...identity, items };
        else delete carts[key];
        return { carts };
      }),
      updateNotes: (cartKey, lineKey, notes) => set((state) => {
        const cart = state.carts[cartKey];
        const line = cart?.items[lineKey];
        if (!line) return state;
        return { carts: { ...state.carts, [cartKey]: {
          ...cart, items: { ...cart.items, [lineKey]: { ...line, notes } },
        } } };
      }),
      removeItem: (cartKey, lineKey) => set((state) => {
        const cart = state.carts[cartKey];
        if (!cart?.items[lineKey]) return state;
        const items = { ...cart.items };
        delete items[lineKey];
        const carts = { ...state.carts };
        if (Object.keys(items).length) carts[cartKey] = { ...cart, items };
        else delete carts[cartKey];
        return { carts };
      }),
      clearCart: (cartKey) => set((state) => {
        const carts = { ...state.carts };
        delete carts[cartKey];
        return { carts };
      }),
      clearSupplierCart: (supplierId) => set((state) => ({
        carts: Object.fromEntries(Object.entries(state.carts).filter(([, cart]) => cart.supplierId !== supplierId)),
      })),
      clearAllMenuCarts: () => set({ carts: {} }),
      getSupplierCart: (supplierId, menuId) => get().carts[menuCartKey(supplierId, menuId)],
      getTotalMenuItems: () => Object.values(get().carts).reduce((sum, cart) => sum + menuCartQuantity(cart), 0),
    }),
    {
      name: "menu-carts-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ carts: state.carts }),
      version: 1,
    },
  ),
);

function subscribeToHydration(onChange: () => void) {
  const offStart = useMenuCartStore.persist.onHydrate(onChange);
  const offFinish = useMenuCartStore.persist.onFinishHydration(onChange);
  return () => { offStart(); offFinish(); };
}

export function useMenuCartHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => useMenuCartStore.persist.hasHydrated(),
    () => false,
  );
}
