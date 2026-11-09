import { create } from "zustand";

type SupplierPageModeState = {
  isDirectory: boolean;
  productsAllowed: boolean;
  setProductsAllowed: (productsAllowed: boolean) => void;
  setDirectoryMode: (isDirectory: boolean) => void;
};

export const useSupplierPageModeStore = create<SupplierPageModeState>((set) => ({
  isDirectory: false,
  productsAllowed: false,
  setProductsAllowed: (productsAllowed) => set({ productsAllowed }),
  setDirectoryMode: (isDirectory) => set({ isDirectory }),
}));
