import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Message } from '@/types/chat';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatWebSocketReturn {
    status: WebSocketStatus;
    messages: Message[];
    sendMessage: (content: string, conversationId: number | string) => void;
    lastMessage: Message | null;
  }

export const useChatWebSocket = (activeConversationId?: string | number, shouldConnect: boolean = true): UseChatWebSocketReturn => {
  const { token, user } = useAuthStore();
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!token || !shouldConnect || !activeConversationId) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');

    const wsUrlEnv = process.env.NEXT_PUBLIC_WS_URL;
    let wsUrl: string;

    // Build URL: WS_BASE/ws/chat/{conversationId}?token=...
    // as per chat.md documentation: ws://<HOST>:<PORT>/ws -> /ws/chat/{id}
    const baseUrl = (wsUrlEnv || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080')
        .replace(/^http/, 'ws')
        .replace(/\/$/, '');
    
    // Ensure we point to /ws/chat endpoint
    // If baseUrl ends with /ws, we append /chat/{id}
    // If not, we append /ws/chat/{id}
    
    const baseWithWs = baseUrl.endsWith('/ws') ? baseUrl : `${baseUrl}/ws`;
    
    wsUrl = `${baseWithWs}/chat/${activeConversationId}?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl.replace(/token=([^&]+)/, 'token=***'));
    
    try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            console.log('[WebSocket] Raw message received:', event.data);
            const data = JSON.parse(event.data);
            
            // Map backend fields to frontend Message interface
            // Backend sends: { id, sender_id, message, conversation_id, timestamp }
            // Infer message_type if missing but attachment_url is present
            let type = data.message_type;
            if (!type && data.attachment_url) {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(data.attachment_url);
                type = isImage ? 'image' : 'file';
            }

            // Frontend expects: { id, sender_id, content, conversation_id, created_at, ... }
            const message: Message = {
                id: data.id,
                sender_id: data.sender_id || data.senderId,
                conversation_id: data.conversation_id || data.conversationId,
                content: data.message || data.content || '', // Handle 'message' field from backend
                created_at: data.timestamp || data.created_at || new Date().toISOString(), // Handle 'timestamp' field
                is_read: data.is_read || false,
                message_type: type || 'text',
                attachment_url: data.attachment_url
            };
            
            console.log('[WebSocket] Parsed message:', message);

            setLastMessage(message);
            
            // If the message belongs to the current active conversation, add it to the list
            if (activeConversationId && String(message.conversation_id) === String(activeConversationId)) {
                setMessages((prev) => {
                    // Check for duplicates
                    if (prev.some(m => m.id === message.id)) return prev;
                    console.log('[WebSocket] Adding message to state:', message);
                    return [...prev, message];
                });
            } else {
                console.warn('[WebSocket] Message ignored due to conversation ID mismatch:', {
                    msgConvId: message.conversation_id,
                    activeConvId: activeConversationId
                });
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          setStatus('disconnected');
          // Attempt reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        };

        ws.onerror = (error) => {
        // Only log error if status is not already error to avoid spam
        console.warn('WebSocket connection issue:', error); 
        setStatus('error');
      };
  } catch (e) {
      console.warn("Failed to create WebSocket connection", e);
      setStatus('error');
  }

  }, [token, activeConversationId, shouldConnect]);

  useEffect(() => {
    if (shouldConnect) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, shouldConnect]);

  const sendMessage = useCallback((content: string, conversationId: number | string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Backend expects plain text content
      wsRef.current.send(content);
      
      // Optimistic update
      const optimisticMsg: Message = {
        id: Date.now(), // Temporary ID
        content,
        sender_id: Number(user?.id) || 0, // Use actual user ID for correct alignment
        conversation_id: conversationId,
        created_at: new Date().toISOString(),
        is_read: false,
        message_type: 'text'
      };
      
      setLastMessage(optimisticMsg);
      setMessages((prev) => [...prev, optimisticMsg]);
    } else {
      console.warn('WebSocket is not connected');
      throw new Error('WebSocket is not connected');
    }
  }, []);

  return { status, messages, sendMessage, lastMessage };
};
