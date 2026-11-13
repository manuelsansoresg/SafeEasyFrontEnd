"use client";

import { useEffect, useState } from "react";
import { canSubscriptionManageServices, isDirectorySubscription } from "@/lib/subscriptionAccess";
import { subscriptionsService } from "@/services/subscriptionsService";
import { useAuthStore } from "@/store/useAuthStore";

export function useMyDirectorySubscription(enabled = true) {
  const token = useAuthStore((state) => state.token);
  const [isDirectory, setIsDirectory] = useState(false);
  const [canManageServices, setCanManageServices] = useState(false);
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !token) {
      const resetId = window.setTimeout(() => {
        setIsDirectory(false);
        setCanManageServices(false);
        setCanManageProducts(false);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(resetId);
    }

    let cancelled = false;
    const loadId = window.setTimeout(() => {
      setLoading(true);
      subscriptionsService
        .getMySubscription()
        .then(async (subscription) => {
          if (!cancelled) {
            setIsDirectory(isDirectorySubscription(subscription));
            setCanManageServices(canSubscriptionManageServices(subscription));
          }
          const allowed = await subscriptionsService.canManageProducts(subscription).catch((error) => {
            console.error("Error loading product access:", error);
            return false;
          });
          if (!cancelled) {
            setCanManageProducts(allowed);
          }
        })
        .catch((error) => {
          console.error("Error loading directory subscription:", error);
          if (!cancelled) {
            setIsDirectory(false);
            setCanManageServices(false);
            setCanManageProducts(false);
          }
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

  return { isDirectory, canManageServices, canManageProducts, loading };
}
