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
    // Preserve this user's access data while a refreshed token starts a new query.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === user?.id ? previousData : undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const modules = query.data ?? [];
  const getModule = (code: string): SupplierModule | undefined =>
    modules.find((module) => module.code.trim().toLowerCase() === code.trim().toLowerCase());

  return {
    modules,
    // Background access checks must not unmount forms with unsaved changes.
    loading: query.isLoading,
    error: query.error,
    hasModule: (code: string) => !query.error && getModule(code)?.has_access === true,
    getModule,
    retry: query.refetch,
  };
}
