import { create } from "zustand";

type SupplierPageModeState = {
  isDirectory: boolean;
  setDirectoryMode: (isDirectory: boolean) => void;
};

export const useSupplierPageModeStore = create<SupplierPageModeState>((set) => ({
  isDirectory: false,
  setDirectoryMode: (isDirectory) => set({ isDirectory }),
}));
