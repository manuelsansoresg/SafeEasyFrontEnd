"use client";

import { useEffect, useState } from "react";
import { agendaService } from "@/services/agendaService";

export function useAgendaModuleAccess(enabled = true) {
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
    agendaService
      .access(controller.signal)
      .then((result) => setHasAccess(result.has_access))
      .catch(() => setHasAccess(false))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [enabled]);

  return { loading, hasAccess };
}
