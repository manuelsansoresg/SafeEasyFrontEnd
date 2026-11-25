"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export function useLinkedCommissionEmail(userId: string) {
  const token = useAuthStore((state) => state.token);
  const [result, setResult] = useState<{ userId: string; email: string | null } | null>(null);

  useEffect(() => {
    if (!token || !userId) return;
    const controller = new AbortController();

    async function loadEmail() {
      try {
        const response = await fetchWithAuth(`/api/users/${encodeURIComponent(userId)}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("No se pudo cargar el usuario");
        const user = await response.json();
        const email = typeof user.email === "string" ? user.email.trim() : "";
        if (!controller.signal.aborted) setResult({ userId, email: email || null });
      } catch {
        if (!controller.signal.aborted) setResult({ userId, email: null });
      }
    }

    void loadEmail();
    return () => controller.abort();
  }, [token, userId]);

  if (!userId) return "";
  if (result?.userId !== userId) return "Cargando correo…";
  return result.email || "Correo no disponible";
}
