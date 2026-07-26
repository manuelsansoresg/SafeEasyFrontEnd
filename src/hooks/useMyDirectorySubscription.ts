"use client";

import { useEffect, useState } from "react";
import { isDirectorySubscription } from "@/lib/subscriptionAccess";
import { subscriptionsService } from "@/services/subscriptionsService";
import { useAuthStore } from "@/store/useAuthStore";

export function useMyDirectorySubscription(enabled = true) {
  const token = useAuthStore((state) => state.token);
  const [isDirectory, setIsDirectory] = useState(false);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !token) {
      const resetId = window.setTimeout(() => {
        setIsDirectory(false);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(resetId);
    }

    let cancelled = false;
    const loadId = window.setTimeout(() => {
      setLoading(true);
      subscriptionsService
        .getMySubscription()
        .then((subscription) => {
          if (!cancelled) setIsDirectory(isDirectorySubscription(subscription));
        })
        .catch((error) => {
          console.error("Error loading directory subscription:", error);
          if (!cancelled) setIsDirectory(false);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(loadId);
    };
  }, [enabled, token]);

  return { isDirectory, loading };
}
