import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Message } from '@/types/chat';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatWebSocketReturn {
    status: WebSocketStatus;
    messages: Message[];
    sendMessage: (content: string, conversationId: number | string) => void;
    lastMessage: Message | null;
    error: string | null;
  }

export const useChatWebSocket = (activeConversationId?: string | number, shouldConnect: boolean = true): UseChatWebSocketReturn => {
  const { token, user } = useAuthStore();
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!token || !shouldConnect || !activeConversationId) return;

    // Skip connection for temporary conversations
    if (String(activeConversationId).startsWith('temp-')) {
        console.log('[WebSocket] Skipping connection for temporary conversation');
        return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      // Prevent reconnect attempts from old connection
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setStatus('connecting');
    setWsError(null);
    // Clear messages when starting a new connection to avoid mixing conversations
    setMessages([]);

    const wsUrlEnv = process.env.NEXT_PUBLIC_WS_URL;
    let wsUrl: string;

    // Build URL: WS_BASE/ws/chat/{conversationId}?token=...
    // as per chat.md documentation: ws://<HOST>:<PORT>/ws -> /ws/chat/{id}
    const envBase = wsUrlEnv || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
    
    // Normalize base URL:
    // 1. Remove trailing slash
    // 2. Replace http with ws
    const baseUrl = envBase
        .replace(/\/+$/, '')
        .replace(/^http/, 'ws');
    
    // Ensure we point to /ws/chat endpoint
    // If baseUrl ends with /ws, we append /chat/{id}
    // If not, we append /ws/chat/{id}
    
    // NOTE: If the backend is mounted at /api, we usually need to keep /api in the path
    // e.g. https://drooopy.com/api -> wss://drooopy.com/api/ws/chat/...
    
    const baseWithWs = baseUrl.endsWith('/ws') ? baseUrl : `${baseUrl}/ws`;
    
    // Encode token just in case
    const encodedToken = encodeURIComponent(token || '');
    wsUrl = `${baseWithWs}/chat/${activeConversationId}?token=${encodedToken}`;

    console.log('Connecting to WebSocket:', wsUrl.replace(/token=([^&]+)/, 'token=***'));
    
    try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // Timeout de conexión: si después de X segundos no se abrió la conexión
        // ni se cerró, asumimos que hay problema en el backend y marcamos error.
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
        }
        connectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] Connection timeout reached, closing socket');
            try {
              wsRef.current.close();
            } catch {}
            setStatus('error');
            setWsError('El chat tardó demasiado en conectar. Intenta de nuevo más tarde.');
          }
        }, 10000);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
          setWsError(null);
          reconnectAttemptsRef.current = 0;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
        };
        
        ws.onmessage = (event) => {
          try {
            console.log('[WebSocket] Raw message received:', event.data);
            const data = JSON.parse(event.data);

            // Manejo explícito de cierre lógico enviado como mensaje
            if (data.type === 'close_reason') {
              const code = Number(data.code);
              let msg = data.reason || 'Chat no disponible.';
              if (code === 4000) msg = 'Esta sala de chat no es válida.';
              else if (code === 4003) msg = 'No tienes permiso para ver este chat.';
              else if (code === 4004) msg = 'La conversación de chat ya no existe.';
              else if (code === 1011) msg = 'Hubo un problema en el servidor de chat. Intenta de nuevo más tarde.';

              setStatus('error');
              setWsError(msg);
              try { ws.close(); } catch {}
              return;
            }

            // Si el backend envía eventos de otro tipo (por ejemplo conversation_updated),
            // no los tratamos como mensajes de chat aquí para evitar errores.
            if (data.type && data.type !== 'message') {
              console.log('[WebSocket] Non-message event received:', data.type);
              return;
            }
            
            let type = data.message_type;
            if (!type && data.attachment_url) {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(data.attachment_url);
                type = isImage ? 'image' : 'file';
            }

            const message: Message = {
                id: data.id,
                sender_id: data.sender_id || data.senderId,
                conversation_id: data.conversation_id || data.conversationId,
                content: data.message || data.content || '',
                created_at: data.timestamp || data.created_at || new Date().toISOString(),
                is_read: data.is_read || false,
                message_type: type || 'text',
                attachment_url: data.attachment_url
            };
            
            console.log('[WebSocket] Parsed message:', message);

            setLastMessage(message);
            
            if (activeConversationId && String(message.conversation_id) === String(activeConversationId)) {
                setMessages((prev) => {
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
          console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}, WasClean: ${event.wasClean}`);
          
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          
          if (event.code === 4003) {
            setStatus('error');
            setWsError('No tienes permiso para ver este chat.');
            return;
          }

          if (event.code === 4000) {
            setStatus('error');
            setWsError('Esta sala de chat no es válida.');
            return;
          }

          if (event.code === 4004) {
            setStatus('error');
            setWsError('La conversación de chat ya no existe.');
            return;
          }

          if (event.code === 1008) {
            setStatus('error');
            setWsError(
              event.reason ||
                'Tu sesión no tiene permisos para usar este chat. Inicia sesión de nuevo.'
            );
            return;
          }

          if (event.code === 1011) {
            setStatus('error');
            setWsError(
              event.reason ||
                'Hubo un problema en el servidor de chat. Intenta de nuevo más tarde.'
            );
            return;
          }

          // Limitar reintentos para evitar ciclos infinitos si el servidor está caído
          reconnectAttemptsRef.current += 1;
          if (reconnectAttemptsRef.current > 5) {
            setStatus('error');
            setWsError('No se pudo conectar al chat. Intenta recargar la página.');
            return;
          }

          setStatus('disconnected');
          setWsError('Se perdió la conexión con el chat. Intentando reconectar...');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryTrigger(t => t + 1);
          }, 1500);
        };

        ws.onerror = (error) => {
          console.warn('WebSocket connection issue:', error); 
          setStatus('error');
          setWsError('No se pudo conectar al chat. Verifica tu conexión a internet.');
          try {
            ws.close();
          } catch (e) {
            console.warn('Error closing WebSocket after onerror', e);
          }
        };
  } catch (e) {
      console.warn("Failed to create WebSocket connection", e);
      setStatus('error');
      setWsError('Fallo al crear conexión WebSocket');
  }

  }, [token, activeConversationId, shouldConnect]);

  useEffect(() => {
    if (shouldConnect) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    };
  }, [connect, shouldConnect, retryTrigger]);

  const sendMessage = useCallback((content: string, conversationId: number | string) => {
     // ... (existing sendMessage) ...
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
  }, [user?.id]);

  return { status, messages, sendMessage, lastMessage, error: wsError };
};
