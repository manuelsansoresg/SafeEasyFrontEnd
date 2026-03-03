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
  
  // Actions
  fetchConversations: () => Promise<void>;
  connectSocket: (userId: number) => void;
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

  connectSocket: (userId: number) => {
    const { socket } = get();
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
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

    // Determine WS URL from API Base URL
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
    const wsBase = apiBase.replace(/^http/, 'ws');
    // Ensure no double slashes if apiBase ends with /
    const cleanWsBase = wsBase.replace(/\/$/, '');
    const wsUrl = `${cleanWsBase}/ws/chat/${userId}?token=${token}`;
    
    console.log(`[ChatStore] Connecting to WebSocket: ${wsUrl.split('?')[0]}...`); // Log without token for security
    
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('[ChatStore] WebSocket Connected');
      set({ isConnected: true, error: null });
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
      set({ isConnected: false, socket: null });
      
      // Attempt to reconnect if not closed normally (1000)
      if (event.code !== 1000) {
        console.log('[ChatStore] Attempting to reconnect in 3s...');
        setTimeout(() => {
            const currentUser = useAuthStore.getState().user;
            if (currentUser?.id) {
                get().connectSocket(currentUser.id);
            }
        }, 3000);
      }
    };

    newSocket.onerror = (error) => {
      console.error('[ChatStore] WebSocket Error:', error);
      // Let onclose handle reconnection
    };

    set({ socket: newSocket });
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
