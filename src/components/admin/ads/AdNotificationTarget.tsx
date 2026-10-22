"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { adsErrorMessage, findAdById, type AdItem } from "@/services/adsService";
import { AdError, AdLoading } from "@/components/admin/ads/AdControls";

export function AdNotificationTarget({ id, audience, children }: {
  id: number; audience: "admin" | "supplier"; children: (ad: AdItem) => ReactNode;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const ref = useRef<HTMLElement>(null);
  const result = useQuery({
    queryKey: ["advertising", audience, userId, "target", id],
    queryFn: ({ signal }) => findAdById(audience, id, signal),
    retry: false,
  });
  useEffect(() => {
    if (result.data?.id) {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result.data?.id]);
  return <section ref={ref} tabIndex={-1} aria-label={`Anuncio ${id} de la notificación`} className="scroll-mt-32 space-y-3 rounded-2xl border-2 border-[#168e00]/30 bg-green-50/40 p-3 outline-none sm:p-4">
    <h2 className="text-base font-semibold text-[#004e28]">Anuncio #{id} de la notificación</h2>
    {result.isFetching ? <AdLoading>Localizando el anuncio entre todas las páginas...</AdLoading>
      : result.isError ? <AdError message={adsErrorMessage(result.error)} retry={() => void result.refetch()} />
      : result.data ? children(result.data) : <p className="text-sm text-gray-600">Este anuncio ya no está disponible. Puede haberse eliminado o no pertenecer a tu cuenta.</p>}
  </section>;
}
