import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat';
import { chatService } from '@/services/chatService';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  activeSocketConversationId?: string | number; // Added
  
  // Actions
  fetchConversations: () => Promise<void>;
  connectSocket: (conversationId: string | number) => void;
  disconnectSocket: () => void;
  markAsRead: (conversationId: string | number) => Promise<void>;
  addMessageToConversation: (conversationId: string | number, message: Message) => void;
  updateConversationList: (conversation: Conversation) => void;
  subscribeToMessages: (callback: (message: Message) => void) => () => void;
  sendMessage: (conversationId: string | number, content: string, type?: 'text' | 'image' | 'file') => void;
}

type MessageCallback = (message: Message) => void;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  loading: false,
  error: null,
  socket: null,
  isConnected: false,
  isConnecting: false,
  messageSubscribers: new Set<MessageCallback>(),

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
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
      set({ error: err.message || 'Failed to fetch conversations', loading: false });
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
       const state = get() as any;
       if (state.activeSocketConversationId === conversationId && isConnected) {
           return;
       }
       // If different, fall through to close and reconnect
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
        console.log('[ChatStore] Connection already in progress...');
        return;
    }

    // Close existing if any (e.g. closed/closing state)
    if (socket) {
      socket.close();
    }

    const token = useAuthStore.getState().token;
    if (!token) {
        console.warn('[ChatStore] Cannot connect: No token available');
        return;
    }

    set({ isConnecting: true });

    // Determine WS URL from API Base URL
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
    const wsBase = apiBase.replace(/^http/, 'ws');
    // Ensure no double slashes if apiBase ends with /
    const cleanWsBase = wsBase.replace(/\/$/, '');
    
    // IMPORTANT: Backend expects /ws/chat/{conversation_id}
    const wsUrl = `${cleanWsBase}/ws/chat/${conversationId}?token=${token}`;
    
    console.log(`[ChatStore] Connecting to WebSocket for Conversation ${conversationId}: ${wsUrl.split('?')[0]}...`); 
    
    try {
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = () => {
          console.log('[ChatStore] WebSocket Connected');
          set({ isConnected: true, error: null, isConnecting: false, activeSocketConversationId: conversationId } as any);
        };

        newSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[ChatStore] WebSocket Message:', data);
            
            // Handle incoming messages
            // Expecting data format consistent with chat system
            // If it's a new message, we might need to update the conversation list
            
            if (data.type === 'message' || data.message) { // Adjust based on actual payload
                // Normalize message
                let type = data.message_type;
                if (!type && data.attachment_url) {
                    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(data.attachment_url);
                    type = isImage ? 'image' : 'file';
                }
    
                const msg: Message = {
                    id: data.id || Date.now(),
                    sender_id: data.sender_id || data.senderId,
                    conversation_id: data.conversation_id || data.conversationId,
                    content: data.message || data.content || '',
                    created_at: data.timestamp || data.created_at || new Date().toISOString(),
                    is_read: data.is_read || false,
                    message_type: type || 'text',
                    attachment_url: data.attachment_url,
                    product_id: data.product_id,
                    product: data.product
                };
    
                const conversationId = msg.conversation_id;
                
                // Notify subscribers
                // @ts-ignore - Dynamic property not in interface but used internally
                const subscribers = get().messageSubscribers as Set<MessageCallback>;
                if (subscribers) {
                    subscribers.forEach(callback => callback(msg));
                }
                
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
          console.log('[ChatStore] WebSocket Disconnected', event.code, event.reason);
          set({ isConnected: false, socket: null, isConnecting: false });
          
          // Attempt to reconnect if not closed normally (1000) and NOT an auth error (usually 4xxx codes mapped to WS close codes)
          // 1000: Normal Closure
          // 1006: Abnormal Closure (e.g. server died or network lost) - Retry
          // 4001/4003: Auth errors (custom) - Do NOT retry loop
          
          if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
            console.log('[ChatStore] Attempting to reconnect in 5s...');
            setTimeout(() => {
                const currentConversationId = (get() as any).activeSocketConversationId;
                if (currentConversationId) {
                    get().connectSocket(currentConversationId);
                }
            }, 5000);
          }
        };

        newSocket.onerror = (error) => {
          console.error('[ChatStore] WebSocket Error:', error);
          set({ isConnecting: false });
          // Let onclose handle reconnection
        };

        set({ socket: newSocket });
    } catch (e) {
        console.error("[ChatStore] Failed to create WebSocket", e);
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
      // @ts-ignore
      const subscribers = get().messageSubscribers || new Set<MessageCallback>();
      subscribers.add(callback);
      // @ts-ignore
      set({ messageSubscribers: subscribers });
      
      return () => {
          subscribers.delete(callback);
          // @ts-ignore
          set({ messageSubscribers: subscribers });
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
          console.warn('[ChatStore] Cannot send message: Socket not connected');
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
