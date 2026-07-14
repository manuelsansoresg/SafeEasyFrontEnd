import { create } from 'zustand';
import { Conversation, Message, ChatInboxEvent } from '@/types/chat';
import { chatService, cleanMessageContent } from '@/services/chatService';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  totalUnread: number;
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  activeSocketConversationId?: string | number; // Added
  inboxSocket: WebSocket | null;
  isInboxConnected: boolean;
  isInboxConnecting: boolean;
  messageSubscribers: Set<MessageCallback>;
  inboxSubscribers: Set<InboxEventCallback>;
  
  // Actions
  fetchConversations: () => Promise<void>;
  connectSocket: (conversationId: string | number) => void;
  disconnectSocket: () => void;
  connectInboxSocket: () => void;
  disconnectInboxSocket: () => void;
  markAsRead: (conversationId: string | number) => Promise<void>;
  addMessageToConversation: (conversationId: string | number, message: Message) => void;
  updateConversationList: (conversation: Conversation) => void;
  subscribeToMessages: (callback: (message: Message) => void) => () => void;
  subscribeToInboxEvents: (callback: (event: ChatInboxEvent) => void) => () => void;
  sendMessage: (conversationId: string | number, content: string, type?: 'text' | 'image' | 'file') => void;
}

type MessageCallback = (message: Message) => void;
type InboxEventCallback = (event: ChatInboxEvent) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const logChatConnectionWarning = (message: string, event?: Event) => {
  if (process.env.NODE_ENV !== "development") return;
  const target = event?.target;
  const readyState =
    target instanceof WebSocket
      ? ` readyState=${target.readyState}`
      : "";
  console.warn(`${message}${readyState}`);
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  loading: false,
  error: null,
  totalUnread: 0,
  socket: null,
  isConnected: false,
  isConnecting: false,
  inboxSocket: null,
  isInboxConnected: false,
  isInboxConnecting: false,
  messageSubscribers: new Set<MessageCallback>(),
  inboxSubscribers: new Set<InboxEventCallback>(),

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const data = await chatService.getConversations();
      // Sort by last message time (descending)
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      set({ conversations: sorted, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to fetch conversations";
      console.error("Failed to fetch conversations:", err);
      set({ error: message, loading: false });
    }
  },

  connectInboxSocket: () => {
    const { inboxSocket, isInboxConnecting, isInboxConnected } = get();

    if (
      inboxSocket &&
      (inboxSocket.readyState === WebSocket.OPEN ||
        inboxSocket.readyState === WebSocket.CONNECTING)
    ) {
      if (isInboxConnected) return;
    }

    if (isInboxConnecting) return;

    if (inboxSocket) {
      inboxSocket.close();
    }

    const token = useAuthStore.getState().token;
    const cleanedWsToken = String(token || "")
      .trim()
      .replace(/^bearer\s+/i, "")
      .trim();
    if (!cleanedWsToken) return;

    set({ isInboxConnecting: true });

    const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL;

    let wsUrl = "";
    if (explicitWsUrl) {
      // Si se definió explícitamente la URL base del WS, la usamos. Ej: wss://drooopy.com/api
      const baseWs = explicitWsUrl.replace(/\/+$/, "");
      wsUrl = `${baseWs}/ws/chat/inbox?token=${encodeURIComponent(cleanedWsToken)}`;
    } else {
      const apiBase = rawApiBase.startsWith("/")
        ? typeof window !== "undefined"
          ? `${window.location.origin}${rawApiBase}`
          : "https://drooopy.com/api"
        : rawApiBase;

      try {
        const base = new URL(apiBase);
        const secure = base.protocol === "https:" || base.protocol === "wss:";
        base.protocol = secure ? "wss:" : "ws:";
        const basePath = base.pathname.replace(/\/+$/, "");
        const apiPath = !basePath || basePath === "/" ? "/api" : basePath;
        wsUrl = `${base.protocol}//${base.host}${apiPath}/ws/chat/inbox?token=${encodeURIComponent(cleanedWsToken)}`;
      } catch {
        const fallbackBase =
          typeof window !== "undefined" ? window.location.origin : "https://drooopy.com";
        const fallbackProtocol = fallbackBase.startsWith("https://") ? "wss://" : "ws://";
        const fallbackHost = fallbackBase.replace(/^https?:\/\//, "");
        wsUrl = `${fallbackProtocol}${fallbackHost}/api/ws/chat/inbox?token=${encodeURIComponent(cleanedWsToken)}`;
      }
    }

    if (process.env.NODE_ENV === "development") console.log(`[ChatStore] Intentando conectar Inbox WS a: ${wsUrl.split('?')[0]}?token=${cleanedWsToken ? '[OCULTO]' : 'FALTA_TOKEN'}`);

    try {
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        set({
          isInboxConnected: true,
          isInboxConnecting: false,
          inboxSocket: newSocket,
        });
      };

      newSocket.onmessage = (event) => {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          parsed = { type: "unknown", raw: event.data };
        }

        if (!isRecord(parsed) || typeof parsed.type !== "string") return;
        const payload = parsed as ChatInboxEvent;
        get().inboxSubscribers.forEach((cb) => cb(payload));

        const type = parsed.type;
        if (type === "unread_aggregate") {
          const rawTotal = (parsed as Record<string, unknown>).total_unread;
          const total = typeof rawTotal === "number" ? rawTotal : Number(rawTotal || 0);
          set({ totalUnread: Number.isFinite(total) ? total : 0 });
          return;
        }

        const rawConversationId = (parsed as Record<string, unknown>).conversation_id;
        if (rawConversationId === undefined || rawConversationId === null) return;
        const conversationId = String(rawConversationId);

        const state = get();
        const idx = state.conversations.findIndex((c) => String(c.id) === conversationId);

        if (type === "conversation_updated" || type === "new_message") {
          const record = parsed as Record<string, unknown>;
          const createdAt =
            typeof record.created_at === "string"
              ? record.created_at
              : typeof record.updated_at === "string"
                ? record.updated_at
                : new Date().toISOString();
          const lastMessage =
            typeof record.last_message === "string"
              ? record.last_message
              : typeof record.content_preview === "string"
                ? record.content_preview
                : "Nuevo mensaje";
          const unreadFromEvent =
            typeof record.unread_count === "number" ? record.unread_count : undefined;

          if (idx === -1) {
            state.fetchConversations();
            return;
          }

          const conv = state.conversations[idx];
          const currentUnread = Number(conv.unread_count || 0);
          const nextUnread =
            unreadFromEvent !== undefined
              ? unreadFromEvent
              : type === "new_message"
                ? currentUnread + 1
                : currentUnread;

          const updatedConv: Conversation = {
            ...conv,
            last_message: String(lastMessage || ""),
            last_message_at: String(createdAt || conv.last_message_at || conv.updated_at),
            updated_at: String(createdAt || conv.updated_at),
            unread_count: nextUnread,
          };

          const updated = [...state.conversations];
          updated.splice(idx, 1);
          updated.unshift(updatedConv);
          set({ conversations: updated });
        }
      };

      newSocket.onclose = (closeEvent) => {
        if (process.env.NODE_ENV === "development") console.log('[ChatStore] Inbox WS cerrado:', closeEvent.code, closeEvent.reason);
        set({ isInboxConnected: false, inboxSocket: null, isInboxConnecting: false });

        const noRetryCodes = new Set([1000, 1008, 4000, 4001, 4003, 4004]);
        if (!noRetryCodes.has(closeEvent.code)) {
          setTimeout(() => {
            get().connectInboxSocket();
          }, 5000);
        }
      };

      newSocket.onerror = (error) => {
        logChatConnectionWarning('[ChatStore] No se pudo conectar Inbox WS.', error);
        set({ isInboxConnecting: false });
      };
    } catch {
      set({ isInboxConnecting: false });
    }
  },

  disconnectInboxSocket: () => {
    const { inboxSocket } = get();
    if (inboxSocket) {
      inboxSocket.close();
      set({ inboxSocket: null, isInboxConnected: false });
    }
  },

  connectSocket: (conversationId: string | number) => {
    const { socket, isConnecting, isConnected } = get();
    
    // Check if already connected or connecting to the SAME conversation?
    // The store only holds one socket. If we switch conversations, we must reconnect.
    // Ideally we should track which conversation the socket is connected to.
    // For now, let's assume if socket is open, we check if we need to switch.
    // But since we don't store connectedConversationId, let's just close and reopen if ID changes or if closed.
    
    // Actually, to avoid aggressive reconnects, let's store currentConversationId in the store state?
    // Or just rely on the caller to only call this when conversation changes.
    
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      // If we are already connected, we might be connected to a different conversation.
      // We should close and reconnect if the URL doesn't match, but we don't have easy access to URL params here without parsing.
      // Simpler approach: The caller (ChatWindow) should handle "if activeConversation changed, connect".
      // But if we call connectSocket(A) then connectSocket(A) again, we should no-op.
      // Let's add `activeSocketConversationId` to state to track this.
       const state = get();
       if (state.activeSocketConversationId === conversationId && isConnected) {
           return;
       }
       // If different, fall through to close and reconnect
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
        // if (process.env.NODE_ENV === "development") console.log('[ChatStore] Connection already in progress...');
        return;
    }

    // Close existing if any (e.g. closed/closing state)
    if (socket) {
      socket.close();
    }

    const token = useAuthStore.getState().token;
    const cleanedWsToken = String(token || "")
      .trim()
      .replace(/^bearer\s+/i, "")
      .trim();
    if (!cleanedWsToken) {
        // console.warn('[ChatStore] Cannot connect: No token available');
        return;
    }

    set({ isConnecting: true });

    const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    
    let wsUrl = "";
    const encodedConversationId = encodeURIComponent(String(conversationId));

    if (explicitWsUrl) {
      const baseWs = explicitWsUrl.replace(/\/+$/, "");
      wsUrl = `${baseWs}/ws/chat/${encodedConversationId}?token=${encodeURIComponent(cleanedWsToken)}`;
    } else {
      const apiBase =
        rawApiBase.startsWith("/")
          ? typeof window !== "undefined"
            ? `${window.location.origin}${rawApiBase}`
            : "https://drooopy.com/api"
          : rawApiBase;
      try {
          const base = new URL(apiBase);
          const secure = base.protocol === "https:" || base.protocol === "wss:";
          base.protocol = secure ? "wss:" : "ws:";
          const basePath = base.pathname.replace(/\/+$/, "");
          const apiPath = !basePath || basePath === "/" ? "/api" : basePath;
          wsUrl = `${base.protocol}//${base.host}${apiPath}/ws/chat/${encodedConversationId}?token=${encodeURIComponent(cleanedWsToken)}`;
      } catch {
          const fallbackBase =
            typeof window !== "undefined" ? window.location.origin : "https://drooopy.com";
          const fallbackProtocol = fallbackBase.startsWith("https://") ? "wss://" : "ws://";
          const fallbackHost = fallbackBase.replace(/^https?:\/\//, "");
          wsUrl = `${fallbackProtocol}${fallbackHost}/api/ws/chat/${encodedConversationId}?token=${encodeURIComponent(cleanedWsToken)}`;
      }
    }
    
    if (process.env.NODE_ENV === "development") console.log(`[ChatStore] Intentando conectar WS de Conversacion ${conversationId} a: ${wsUrl.split('?')[0]}?token=${cleanedWsToken ? '[OCULTO]' : 'FALTA_TOKEN'}`); 
    
    try {
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = () => {
          // if (process.env.NODE_ENV === "development") console.log('[ChatStore] WebSocket Connected');
          set({ isConnected: true, error: null, isConnecting: false, activeSocketConversationId: conversationId });
        };

        newSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // if (process.env.NODE_ENV === "development") console.log('[ChatStore] WebSocket Message:', data);
            
            // Handle incoming messages
            // Expecting data format consistent with chat system
            // If it's a new message, we might need to update the conversation list
            
            if (data.type === 'message' || data.message) { 
                // Normalize message
                let content = data.message || data.content || '';
                let type = data.message_type;
                let conversationId = data.conversation_id || data.conversationId;
                let senderId = data.sender_id || data.senderId;
                let productId = data.product_id;
                
                // Handle potential nested JSON string in content (common with some WS backends)
                // First try to extract metadata if it's a JSON string
                if (typeof content === 'string' && content.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed.message || parsed.content) {
                            // Recover other fields if missing
                            if (!type) type = parsed.message_type;
                            if (!conversationId) conversationId = parsed.conversation_id;
                            if (!senderId) senderId = parsed.sender_id;
                            if (!productId) productId = parsed.product_id;
                        }
                    } catch {
                        // Not JSON, ignore
                    }
                }

                // Use the shared cleaning function to ensure consistent display
                content = cleanMessageContent(content);
                
                // Determine type
                if (!type && data.attachment_url) {
                    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(data.attachment_url);
                    type = isImage ? 'image' : 'file';
                }
    
                const msg: Message = {
                    id: data.id || Date.now(),
                    sender_id: senderId,
                    conversation_id: conversationId,
                    content: typeof content === 'string' ? content : String(content),
                    created_at: data.timestamp || data.created_at || new Date().toISOString(),
                    is_read: data.is_read || false,
                    message_type: type || 'text',
                    attachment_url: data.attachment_url,
                    product_id: productId,
                    product: data.product
                };
    
                get().messageSubscribers.forEach((callback) => callback(msg));
                
                if (conversationId) {
                    // Update conversation list (move to top, update last message, increment unread)
                    const state = get();
                    const existingConvIndex = state.conversations.findIndex(c => String(c.id) === String(conversationId));
                    
                    if (existingConvIndex !== -1) {
                        const updatedConversations = [...state.conversations];
                        const conv = updatedConversations[existingConvIndex];
                        
                        // Update fields
                        const updatedConv = {
                            ...conv,
                            last_message: msg.content || 'Nuevo mensaje',
                            last_message_at: msg.created_at || new Date().toISOString(),
                            unread_count: (conv.unread_count || 0) + 1,
                            updated_at: msg.created_at || new Date().toISOString()
                        };
                        
                        // Remove and add to top
                        updatedConversations.splice(existingConvIndex, 1);
                        updatedConversations.unshift(updatedConv);
                        
                        set({ conversations: updatedConversations });
                    } else {
                        // New conversation? Fetch all to be safe or try to construct it
                        get().fetchConversations();
                    }
                }
            }
          } catch (e) {
            console.error('[ChatStore] Error parsing WebSocket message:', e);
          }
        };

        newSocket.onclose = (event) => {
          // if (process.env.NODE_ENV === "development") console.log('[ChatStore] WebSocket Disconnected', event.code, event.reason);
          set({ isConnected: false, socket: null, isConnecting: false });
          
          // Attempt to reconnect if not closed normally (1000) and NOT an auth error (usually 4xxx codes mapped to WS close codes)
          // 1000: Normal Closure
          // 1006: Abnormal Closure (e.g. server died or network lost) - Retry
          // 4001/4003: Auth errors (custom) - Do NOT retry loop
          
          const noRetryCodes = new Set([1000, 1008, 4000, 4001, 4003, 4004]);
          if (!noRetryCodes.has(event.code)) {
            // if (process.env.NODE_ENV === "development") console.log('[ChatStore] Attempting to reconnect in 5s...');
            setTimeout(() => {
                const currentConversationId = get().activeSocketConversationId;
                if (currentConversationId) {
                    get().connectSocket(currentConversationId);
                }
            }, 5000);
          }
        };

        newSocket.onerror = (error) => {
          logChatConnectionWarning('[ChatStore] No se pudo conectar WebSocket de conversación.', error);
          set({ isConnecting: false });
          // Let onclose handle reconnection
        };

        set({ socket: newSocket });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[ChatStore] No se pudo crear WebSocket:", message);
        set({ isConnecting: false });
    }
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },

  subscribeToMessages: (callback: MessageCallback) => {
      const next = new Set(get().messageSubscribers);
      next.add(callback);
      set({ messageSubscribers: next });
      
      return () => {
          const after = new Set(get().messageSubscribers);
          after.delete(callback);
          set({ messageSubscribers: after });
      };
  },

  subscribeToInboxEvents: (callback: InboxEventCallback) => {
      const next = new Set(get().inboxSubscribers);
      next.add(callback);
      set({ inboxSubscribers: next });

      return () => {
          const after = new Set(get().inboxSubscribers);
          after.delete(callback);
          set({ inboxSubscribers: after });
      };
  },

  sendMessage: (conversationId: string | number, content: string, type: 'text' | 'image' | 'file' = 'text') => {
      const { socket, isConnected } = get();
      if (socket && isConnected) {
          // Send via WebSocket
          // Format depends on backend expectation. Assuming JSON with conversation_id
          const payload = JSON.stringify({
              conversation_id: conversationId,
              message: content,
              message_type: type
          });
          socket.send(payload);
      } else {
          // console.warn('[ChatStore] Cannot send message: Socket not connected');
      }
  },

  markAsRead: async (conversationId: string | number) => {
    try {
        // Optimistic update
        set(state => ({
            conversations: state.conversations.map(c => 
                String(c.id) === String(conversationId) 
                ? { ...c, unread_count: 0 } 
                : c
            )
        }));
        
        await chatService.markAsRead(conversationId);
    } catch (err) {
        console.error('Failed to mark as read:', err);
        // Revert if needed, but usually fine to ignore for UI
    }
  },

  addMessageToConversation: (conversationId: string | number, message: Message) => {
      set(state => {
          const index = state.conversations.findIndex(c => String(c.id) === String(conversationId));
          if (index === -1) return state; // Conversation not found in list
          
          const updatedConversations = [...state.conversations];
          const conv = updatedConversations[index];
          
          const updatedConv = {
              ...conv,
              last_message: message.content,
              last_message_at: message.created_at,
              updated_at: message.created_at,
              // If we are sending, unread count doesn't increase for us. 
              // If receiving, it should be handled by onmessage or caller.
              // Assuming this is called when WE send a message:
              unread_count: conv.unread_count // No change
          };
          
          updatedConversations.splice(index, 1);
          updatedConversations.unshift(updatedConv);
          
          return { conversations: updatedConversations };
      });
  },
  
  updateConversationList: (conversation: Conversation) => {
      set(state => {
          const index = state.conversations.findIndex(c => String(c.id) === String(conversation.id));
          const updatedConversations = [...state.conversations];
          
          if (index !== -1) {
              updatedConversations[index] = { ...updatedConversations[index], ...conversation };
          } else {
              updatedConversations.unshift(conversation);
          }
           // Sort again to be safe
           updatedConversations.sort((a, b) => {
                const dateA = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
                return dateB - dateA;
           });
           
           return { conversations: updatedConversations };
      });
  }
}));
