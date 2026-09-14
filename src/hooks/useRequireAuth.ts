"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBrowserPathWithSearchAndHash,
  getLoginUrl,
} from "@/lib/authRedirect";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";

type AuthenticatedAction = () => void | Promise<void>;

type RequireAuthOptions = {
  returnTo?: string;
  onAuthenticated: AuthenticatedAction;
};

export function useRequireAuth() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useCallback(
    (input: AuthenticatedAction | RequireAuthOptions): boolean => {
      if (!hydrated) return false;

      const options =
        typeof input === "function"
          ? { onAuthenticated: input }
          : input;

      if (!isAuthenticated) {
        router.push(
          getLoginUrl(
            options.returnTo ?? getBrowserPathWithSearchAndHash(),
          ),
        );
        return false;
      }

      void options.onAuthenticated();
      return true;
    },
    [hydrated, isAuthenticated, router],
  );
}
