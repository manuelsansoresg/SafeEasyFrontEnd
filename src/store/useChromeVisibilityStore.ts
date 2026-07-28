import { create } from "zustand";

/**
 * Bandera global para ocultar el chrome de Drooopy (Header, Footer, MobileNav)
 * en páginas que necesitan su propio layout/nav.
 *
 * Caso de uso principal: /empresas/[slug] cuando el proveedor tiene una
 * suscripción activa de directorio — su perfil se renderiza como una web
 * independiente y no debe mostrar el header verde de Drooopy.
 *
 * El store se resetea a `false` cuando la página del proveedor se desmonta
 * (en el cleanup del useEffect), para que la siguiente navegación fuera
 * de /empresas/* no herede el estado.
 */
type ChromeVisibilityState = {
  hideForDirectory: boolean;
  setHideForDirectory: (value: boolean) => void;
  reset: () => void;
};

export const useChromeVisibilityStore = create<ChromeVisibilityState>((set) => ({
  hideForDirectory: false,
  setHideForDirectory: (value) => set({ hideForDirectory: value }),
  reset: () => set({ hideForDirectory: false }),
}));
