import { fetchWithAuth } from "@/lib/api";
import { Conversation, Message, CreateConversationParams } from "@/types/chat";

export const chatService = {
  // Get all conversations for the current user
  getConversations: async (): Promise<Conversation[]> => {
    const res = await fetchWithAuth('/api/chat/conversations');
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json();
    return Array.isArray(data) ? data.map((c: any) => ({
        ...c,
        // Standardize fields based on chat.md and legacy support
        my_role: c.my_role,
        other_party_name: c.other_party_name,
        buyer_name: c.buyer_name,
        supplier_name: c.supplier_name,
        
        user_id: c.buyer_id || c.user_id, // Map buyer_id to user_id for compatibility
        buyer_id: c.buyer_id,
        
        // Fallbacks for names if not provided directly
        user_name: c.buyer_name || c.user_name || (c.user ? (c.user.name || `${c.user.first_name || ''} ${c.user.last_name || ''}`.trim()) : undefined),
        
        // Ensure images are populated
        user_image: c.user_image || c.user?.image || c.user?.avatar,
        supplier_image: c.supplier_image || c.supplier?.image || c.supplier?.logo
    })) : [];
  },

  // Get messages for a specific conversation
  getMessages: async (conversationId: number | string): Promise<Message[]> => {
    const res = await fetchWithAuth(`/api/chat/conversations/${conversationId}/messages`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    const data = await res.json();
    // Map backend fields (handle 'message' vs 'content', 'timestamp' vs 'created_at')
    return Array.isArray(data) ? data.map((msg: any) => ({
        ...msg,
        content: msg.message || msg.content || '',
        created_at: msg.timestamp || msg.created_at || new Date().toISOString()
    })) : [];
  },

  createConversation: async (params: CreateConversationParams): Promise<Conversation> => {
    // According to chat.md, we should send product_id in the body.
    // Body: { "product_id": "UUID" }
    const body: any = {};
    if (params.product_id) {
        body.product_id = params.product_id;
    } else {
        // Fallback if no product_id (though docs emphasize product_id)
        body.supplier_id = params.supplier_id;
    }
    
    // Note: initial_message is not in the documented body, but we keep it if backend supports it undocumented,
    // otherwise we might need to send it via WS immediately after connection.
    if (params.initial_message) {
        // body.initial_message = params.initial_message; 
        // Commenting out initial_message as it's not in docs. 
        // Logic should be: Create -> Connect WS -> Send Message.
    }

    const res = await fetchWithAuth('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    const data = await res.json();
    return {
        ...data,
        my_role: data.my_role,
        other_party_name: data.other_party_name,
        buyer_name: data.buyer_name,
        supplier_name: data.supplier_name,
        
        user_id: data.buyer_id || data.user_id,
        buyer_id: data.buyer_id
    };
  },
  
  // Mark messages as read
  markAsRead: async (conversationId: number | string): Promise<void> => {
     await fetchWithAuth(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST'
     });
  },

  // Send a message via REST API
  // NOTE: The provided documentation (chat.md) ONLY lists WebSocket for sending messages.
  // There is NO documented REST endpoint for sending messages.
  // We will keep this method but it might fail if the backend strictly follows chat.md.
  sendMessage: async (conversationId: number | string, content: string, message_type: 'text' | 'image' = 'text'): Promise<Message> => {
     console.warn("[ChatService] Warning: Sending message via REST is not documented in chat.md. Using WebSocket is recommended.");
     
     // We'll try the flat endpoint as a best guess, but expect it might not exist.
     try {
         const payload = { content, message: content, message_type };
         // Try /chat/conversations/{id}/messages
         const res = await fetchWithAuth(`/api/chat/conversations/${conversationId}/messages`, {
           method: 'POST',
           body: JSON.stringify(payload)
         });
         
         if (res.ok) {
             const data = await res.json();
             return {
                 ...data,
                 content: data.message || data.content || content,
                 created_at: data.timestamp || data.created_at || new Date().toISOString()
             };
         }
     } catch (e) { console.warn(e); }

     throw new Error('REST sendMessage not supported or failed. Please use WebSocket.');
  }
};
