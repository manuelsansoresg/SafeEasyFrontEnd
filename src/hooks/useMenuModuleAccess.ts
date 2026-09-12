"use client";

import { useEffect, useState } from "react";
import { menuService } from "@/services/menuService";

export function useMenuModuleAccess(enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setHasAccess(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    menuService
      .access(controller.signal)
      .then((result) => setHasAccess(result.has_access))
      .catch(() => setHasAccess(false))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [enabled]);

  return { loading, hasAccess };
}
