import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { Message, ChatInboxEvent } from '@/types/chat';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatWebSocketReturn {
    status: WebSocketStatus;
    messages: Message[];
    sendMessage: (content: string, conversationId: number | string) => void;
    lastMessage: Message | null;
    error: string | null;
    url: string | null;
  }

export const useChatWebSocket = (activeConversationId?: string | number, shouldConnect: boolean = true): UseChatWebSocketReturn => {
  const { user } = useAuthStore();
  const { isConnected, isConnecting, socket, subscribeToMessages, sendMessage: sendStoreMessage, connectSocket } = useChatStore();
  
  const [messagesByConversationId, setMessagesByConversationId] = useState<Record<string, Message[]>>({});
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status: WebSocketStatus = isConnecting ? "connecting" : isConnected ? "connected" : "disconnected";

  const messages = useMemo(() => {
    if (!activeConversationId) return [];
    return messagesByConversationId[String(activeConversationId)] || [];
  }, [activeConversationId, messagesByConversationId]);

  // Ensure connection is active if we need it
  useEffect(() => {
      // ChatWindow relies on Header.tsx to establish connection generally.
      // But if we are in a standalone context or Header failed, we might want to trigger it.
      // However, to avoid loops, we should be careful.
      // The store now handles isConnecting to prevent race conditions.
      // UPDATED: Now we connect per conversation, so activeConversationId is required.
      
      if (shouldConnect && activeConversationId) {
          // Do not attempt to connect to temporary conversations
          if (String(activeConversationId).startsWith('temp-')) {
              return;
          }

          // Check if we should really connect or if it's already being handled
          // We can call connectSocket, as it now has internal checks
          connectSocket(activeConversationId);
      }
  }, [shouldConnect, activeConversationId, connectSocket]);

  // Subscribe to messages
  useEffect(() => {
      if (!activeConversationId) return;

      const unsubscribe = subscribeToMessages((msg: Message) => {
          // Filter for current conversation
          if (String(msg.conversation_id) === String(activeConversationId)) {
              // console.log('[useChatWebSocket] Received message for active chat:', msg);
              setLastMessage(msg);
              setMessagesByConversationId((prev) => {
                const key = String(activeConversationId);
                const current = prev[key] || [];
                if (current.some((m) => m.id === msg.id)) return prev;
                return { ...prev, [key]: [...current, msg] };
              });
          }
      });

      return () => {
          unsubscribe();
      };
  }, [activeConversationId, subscribeToMessages]);

  const sendMessage = useCallback((content: string, conversationId: number | string) => {
     if (!isConnected) {
         // console.warn('[useChatWebSocket] Cannot send: Not connected');
         // We could try to reconnect or throw
         setError('No hay conexión con el chat');
         return;
     }
     
     // Send via store
     sendStoreMessage(conversationId, content);

     // Optimistic update
     const optimisticMsg: Message = {
        id: Date.now(), // Temporary ID
        content,
        sender_id: Number(user?.id) || 0,
        conversation_id: conversationId,
        created_at: new Date().toISOString(),
        is_read: false,
        message_type: 'text'
      };
      
      setLastMessage(optimisticMsg);
      setMessagesByConversationId((prev) => {
        const key = String(conversationId);
        const current = prev[key] || [];
        return { ...prev, [key]: [...current, optimisticMsg] };
      });

  }, [isConnected, user, sendStoreMessage]);

  return {
      status,
      messages,
      sendMessage,
      lastMessage,
      error,
      url: socket?.url || null
  };
};

interface UseChatInboxWebSocketReturn {
  status: WebSocketStatus;
  lastEvent: ChatInboxEvent | null;
  error: string | null;
  url: string | null;
}

export const useChatInboxWebSocket = (shouldConnect: boolean = true): UseChatInboxWebSocketReturn => {
  const { token } = useAuthStore();
  const {
    inboxSocket,
    isInboxConnected,
    isInboxConnecting,
    connectInboxSocket,
    subscribeToInboxEvents,
  } = useChatStore();

  const [lastEvent, setLastEvent] = useState<ChatInboxEvent | null>(null);
  const status: WebSocketStatus = isInboxConnecting
    ? "connecting"
    : isInboxConnected
      ? "connected"
      : "disconnected";
  const error =
    status === "disconnected" && shouldConnect && !!token ? "Sin conexión con el chat" : null;

  useEffect(() => {
    if (!shouldConnect) return;
    if (!token) return;
    connectInboxSocket();
  }, [shouldConnect, token, connectInboxSocket]);

  useEffect(() => {
    if (!shouldConnect) return;
    if (!token) return;

    const unsubscribe = subscribeToInboxEvents((evt: ChatInboxEvent) => {
      setLastEvent(evt);
    });

    return () => {
      unsubscribe();
    };
  }, [shouldConnect, token, subscribeToInboxEvents]);

  return {
    status,
    lastEvent,
    error,
    url: inboxSocket?.url || null,
  };
};
