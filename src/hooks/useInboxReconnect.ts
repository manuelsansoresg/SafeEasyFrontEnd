import { useEffect, useRef } from "react";

type InboxStatus = "connecting" | "connected" | "disconnected" | "error";

export function useInboxReconnect(
  status: InboxStatus,
  enabled: boolean,
  onReconnect: () => void,
) {
  // 0: aún sin conectar; 1: conectado; 2: se perdió una conexión previa.
  const phase = useRef(0);
  const callback = useRef(onReconnect);

  useEffect(() => { callback.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    if (!enabled) {
      phase.current = 0;
    } else if (status === "connected") {
      if (phase.current === 2) callback.current();
      phase.current = 1;
    } else if (phase.current === 1) {
      phase.current = 2;
    }
  }, [enabled, status]);
}
