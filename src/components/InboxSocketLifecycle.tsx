"use client";

import { useEffect } from "react";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";

export function InboxSocketLifecycle() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const token = useAuthStore((state) => state.token);
  const connectInboxSocket = useChatStore((state) => state.connectInboxSocket);
  const disconnectInboxSocket = useChatStore((state) => state.disconnectInboxSocket);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !userId || !token) {
      disconnectInboxSocket();
      return;
    }
    connectInboxSocket();
  }, [connectInboxSocket, disconnectInboxSocket, hydrated, isAuthenticated, token, userId]);

  return null;
}
