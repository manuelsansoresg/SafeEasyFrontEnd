"use client";

import { useQuery } from "@tanstack/react-query";
import { moduleService } from "@/services/moduleService";
import { useAuthStore } from "@/store/useAuthStore";
import type { SupplierModule } from "@/types/module";

export function useSupplierModules(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const query = useQuery({
    queryKey: ["supplier-modules", user?.id, token],
    queryFn: ({ signal }) => moduleService.mine(signal),
    enabled: enabled && user?.role === "supplier" && Boolean(token),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const modules = query.data ?? [];
  const getModule = (code: string): SupplierModule | undefined =>
    modules.find((module) => module.code.trim().toLowerCase() === code.trim().toLowerCase());

  return {
    modules,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error,
    hasModule: (code: string) => !query.error && getModule(code)?.has_access === true,
    getModule,
    retry: query.refetch,
  };
}
