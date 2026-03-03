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
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  loading: false,
  error: null,
  socket: null,
  isConnected: false,

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

    const wsUrl = `wss://drooopy.com/api/ws/chat/${userId}`;
    console.log(`[ChatStore] Connecting to WebSocket: ${wsUrl}`);
    
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('[ChatStore] WebSocket Connected');
      set({ isConnected: true });
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[ChatStore] WebSocket Message:', data);
        
        // Handle incoming messages
        // Expecting data format consistent with chat system
        // If it's a new message, we might need to update the conversation list
        
        if (data.type === 'message' || data.message) { // Adjust based on actual payload
            const msg = data.message || data; // Normalize
            const conversationId = msg.conversation_id;
            
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
                        last_message: msg.content || msg.message || 'Nuevo mensaje',
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

    newSocket.onclose = () => {
      console.log('[ChatStore] WebSocket Disconnected');
      set({ isConnected: false, socket: null });
      // Optional: Reconnect logic could go here
    };

    newSocket.onerror = (error) => {
      console.error('[ChatStore] WebSocket Error:', error);
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
