import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { Message } from '@/types/chat';

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
  const { isConnected, socket, subscribeToMessages, sendMessage: sendStoreMessage, connectSocket } = useChatStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Sync status with global store
  useEffect(() => {
      if (isConnected) {
          setStatus('connected');
          setError(null);
      } else {
          // If we should be connected but aren't, it might be connecting or disconnected
          // For now, we rely on the store's state. 
          // If store doesn't expose 'connecting', we might just say disconnected
          setStatus('disconnected');
      }
  }, [isConnected]);

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

      // Clear messages when switching conversations? 
      // Usually we want to keep them or fetch from history. 
      // This hook seems to manage *real-time* messages mainly, 
      // but ChatWindow likely fetches history separately.
      // We'll clear here to avoid mixing.
      setMessages([]); 

      const unsubscribe = subscribeToMessages((msg: Message) => {
          // Filter for current conversation
          if (String(msg.conversation_id) === String(activeConversationId)) {
              // console.log('[useChatWebSocket] Received message for active chat:', msg);
              setLastMessage(msg);
              setMessages(prev => {
                  if (prev.some(m => m.id === msg.id)) return prev;
                  return [...prev, msg];
              });
          }
      });

      return () => {
          unsubscribe();
      };
  }, [activeConversationId, subscribeToMessages]);

  const sendMessage = useCallback((content: string, conversationId: number | string) => {
     if (!isConnected) {
         console.warn('[useChatWebSocket] Cannot send: Not connected');
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
      setMessages((prev) => [...prev, optimisticMsg]);

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
