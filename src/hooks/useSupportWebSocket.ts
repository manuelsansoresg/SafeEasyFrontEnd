"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupportSocketEvent } from "@/types/support-chat";

interface UseSupportWebSocketOptions {
  conversationId?: string | null;
  token?: string | null;
  onEvent: (event: SupportSocketEvent) => void;
  enabled?: boolean;
}

const cleanToken = (token?: string | null) =>
  String(token || "")
    .trim()
    .replace(/^bearer\s+/i, "")
    .trim();

const buildSupportWsUrl = (conversationId: string, token: string) => {
  const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  const encodedConversationId = encodeURIComponent(conversationId);
  const encodedToken = encodeURIComponent(token);

  if (explicitWsUrl) {
    return `${explicitWsUrl.replace(/\/+$/, "")}/ws/chat/support/${encodedConversationId}?token=${encodedToken}`;
  }

  const apiBase =
    rawApiBase.startsWith("/") && typeof window !== "undefined"
      ? `${window.location.origin}${rawApiBase}`
      : rawApiBase;

  try {
    const base = new URL(apiBase);
    const secure = base.protocol === "https:" || base.protocol === "wss:";
    base.protocol = secure ? "wss:" : "ws:";
    const basePath = base.pathname.replace(/\/+$/, "");
    const apiPath = !basePath || basePath === "/" ? "/api" : basePath;
    return `${base.protocol}//${base.host}${apiPath}/ws/chat/support/${encodedConversationId}?token=${encodedToken}`;
  } catch {
    const fallbackBase = typeof window !== "undefined" ? window.location.origin : "https://drooopy.com";
    const protocol = fallbackBase.startsWith("https://") ? "wss://" : "ws://";
    const host = fallbackBase.replace(/^https?:\/\//, "");
    return `${protocol}${host}/api/ws/chat/support/${encodedConversationId}?token=${encodedToken}`;
  }
};

export function useSupportWebSocket({
  conversationId,
  token,
  onEvent,
  enabled = true,
}: UseSupportWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (pingRef.current) clearInterval(pingRef.current);
    reconnectRef.current = null;
    pingRef.current = null;
    wsRef.current?.close(1000);
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    const jwt = cleanToken(token);
    if (!enabled || !conversationId || !jwt) {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      reconnectRef.current = null;
      pingRef.current = null;
      wsRef.current?.close(1000);
      wsRef.current = null;
      return;
    }

    let disposed = false;
    const noRetryCodes = new Set([1000, 1008, 4000, 4001, 4003, 4004]);

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(buildSupportWsUrl(conversationId, jwt));
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          onEventRef.current(JSON.parse(event.data) as SupportSocketEvent);
        } catch {
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = null;
        if (!disposed && !noRetryCodes.has(event.code)) {
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [cleanup, conversationId, enabled, token]);

  return { isConnected };
}
