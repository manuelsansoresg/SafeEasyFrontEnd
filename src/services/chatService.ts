import { fetchWithAuth } from "@/lib/api";
import { Conversation, Message, CreateConversationParams } from "@/types/chat";

interface ApiConversation {
  id: number;
  unread_count?: number;
  unread_messages?: number;
  unread_messages_count?: number;
  unread?: number;
  my_role?: string;
  other_party_name?: string;
  buyer_name?: string;
  supplier_name?: string;
  buyer_id?: number;
  user_id?: number;
  user_name?: string;
  user?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    image?: string;
    avatar?: string;
  };
  user_image?: string;
  supplier_image?: string;
  supplier?: {
    image?: string;
    logo?: string;
  };
  [key: string]: unknown;
}

interface ApiMessage {
    id: number;
    message_type?: string;
    attachment_url?: string;
    message?: string;
    content?: string;
    timestamp?: string;
    created_at?: string;
    [key: string]: unknown;
}

export const cleanMessageContent = (content: string | undefined | null): string => {
    if (!content) return '';
    if (typeof content !== 'string') return String(content);
    
    // Check if content is a JSON string wrapper
    // Example: '{"conversation_id":..., "message":"actual text", ...}'
    if (content.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(content);
            // Verify if it looks like the wrapper structure (has 'message' and other fields)
            // Check for message OR content field
            const innerMessage = parsed.message || parsed.content;
            
            // Metadata keys to check to confirm it's a wrapper
            const hasMetadata = parsed.conversation_id || parsed.message_type || parsed.sender_id || parsed.product_id || parsed.id;

            if (innerMessage && hasMetadata) {
                return innerMessage;
            }
        } catch (e) {
            // Not valid JSON, return original
        }
    }
    return content;
};

export const chatService = {
  // Get all conversations for the current user
  getConversations: async (): Promise<Conversation[]> => {
    try {
      const res = await fetchWithAuth('/api/chat/conversations');
      if (!res.ok) {
        console.warn(
          "[chatService] getConversations failed with status",
          res.status
        );
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data.map((c: ApiConversation) => {
        const unread =
          c.unread_count ??
          c.unread_messages ??
          c.unread_messages_count ??
          c.unread ??
          0;
        
                // Clean last_message if it's JSON
        let lastMessage = c.last_message;
        if (typeof lastMessage === 'string' && lastMessage.trim().startsWith('{')) {
             lastMessage = cleanMessageContent(lastMessage);
        }

        return {
          ...c,
          last_message: lastMessage,
          // Normalizar campos según chat.md y compatibilidad previa
          my_role: c.my_role,
          other_party_name: c.other_party_name,
          buyer_name: c.buyer_name,
          supplier_name: c.supplier_name,

          user_id: c.buyer_id || c.user_id,
          buyer_id: c.buyer_id,

          // Fallbacks de nombre
          user_name:
            c.buyer_name ||
            c.user_name ||
            (c.user
              ? c.user.name ||
                `${c.user.first_name || ""} ${c.user.last_name || ""}`.trim()
              : undefined),

          // Imágenes
          user_image: c.user_image || c.user?.image || c.user?.avatar,
          supplier_image: c.supplier_image || c.supplier?.image || c.supplier?.logo,

          // Asegurar unread_count siempre presente
          unread_count: unread,
        } as Conversation;
      }) : [];
    } catch (err) {
      console.error("[chatService] getConversations error", err);
      return [];
    }
  },

  // Get messages for a specific conversation
  getMessages: async (
    conversationId: number | string,
    params?: { skip?: number; limit?: number }
  ): Promise<Message[]> => {
    if (!conversationId || String(conversationId).startsWith("temp-")) {
      return [];
    }

    const skip = params?.skip ?? 0;
    const limit = params?.limit ?? 50;
    const res = await fetchWithAuth(
      `/api/chat/conversations/${conversationId}/messages?skip=${encodeURIComponent(String(skip))}&limit=${encodeURIComponent(String(limit))}`,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[chatService] getMessages failed", {
        conversationId,
        status: res.status,
        detail: text,
      });
      return [];
    }
    const data = await res.json();
    // Map backend fields (handle 'message' vs 'content', 'timestamp' vs 'created_at')
    return Array.isArray(data) ? data.map((msg: ApiMessage) => {
        // Infer message_type if missing but attachment_url is present
        let type = msg.message_type;
        if (!type && msg.attachment_url) {
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(msg.attachment_url);
            type = isImage ? 'image' : 'file';
        }

        return {
            ...msg,
            content: cleanMessageContent(msg.message || msg.content || ''),
            created_at: msg.timestamp || msg.created_at || new Date().toISOString(),
            attachment_url: msg.attachment_url,
            message_type: (type || 'text') as 'text' | 'image' | 'file'
        } as Message;
    }) : [];
  },

  createConversation: async (params: CreateConversationParams): Promise<Conversation> => {
    // According to chat.md, we should send product_id in the body.
    // Body: { "product_id": "UUID" }
    const body: Record<string, unknown> = {};
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

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = "";
      try {
        const parsed = text ? (JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown }) : null;
        detail =
          (typeof parsed?.detail === "string" && parsed.detail) ||
          (Array.isArray(parsed?.detail) ? parsed.detail.map((item) => JSON.stringify(item)).join(", ") : "") ||
          (typeof parsed?.message === "string" && parsed.message) ||
          (typeof parsed?.error === "string" && parsed.error) ||
          "";
      } catch {
        detail = text;
      }
      console.warn("[chatService] createConversation failed", {
        status: res.status,
        detail: text,
        params,
      });

      throw new Error(detail || `No se pudo crear la conversación (${res.status}).`);
    }

    const data: ApiConversation = await res.json();
    return {
        ...data,
        my_role: data.my_role,
        other_party_name: data.other_party_name,
        buyer_name: data.buyer_name,
        supplier_name: data.supplier_name,
        
        user_id: data.buyer_id || data.user_id,
        buyer_id: data.buyer_id
    } as Conversation;
  },
  
  // Mark messages as read
  markAsRead: async (conversationId: number | string): Promise<void> => {
     await fetchWithAuth(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST'
     });
  },

  sendMessage: async (
    conversationId: number | string,
    content: string,
    message_type: 'text' | 'image' | 'file' = 'text',
    file?: File,
    product_id?: string | number,
  ): Promise<Message> => {
     try {
         const formData = new FormData();
         const trimmed = String(content || '').trim();
         const hasMessage = trimmed.length > 0;
         const hasFile = !!file;
         const hasProduct = !!product_id;

         if (!hasMessage && !hasFile && !hasProduct) {
            throw new Error('Message, file, or product_id is required');
         }

         if (hasMessage) {
           formData.append('message', trimmed);
         }
         
         if (file) {
             formData.append('file', file);
             if (message_type !== 'text') {
               formData.append('message_type', message_type);
             }
         }
         
         // Optional product_id for context cards
         if (product_id) {
             formData.append('product_id', String(product_id));
         }
         
         // Try /chat/conversations/{id}/messages
         const res = await fetchWithAuth(`/api/chat/conversations/${conversationId}/messages`, {
           method: 'POST',
           body: formData
         });
         
         if (res.ok) {
             const data: ApiMessage = await res.json();
             return {
                 ...data,
                 content: data.message || data.content || '',
                 created_at: data.timestamp || data.created_at || new Date().toISOString(),
                 message_type: (data.message_type || message_type || 'text') as 'text' | 'image' | 'file'
             } as Message;
         } else {
             const text = await res.text().catch(() => "");
             let detail = "";
             try {
               const parsed = text ? (JSON.parse(text) as any) : null;
               detail =
                 (parsed?.detail && String(parsed.detail)) ||
                 (parsed?.message && String(parsed.message)) ||
                 (parsed?.error && String(parsed.error)) ||
                 "";
             } catch {
               detail = "";
             }
             const suffix = detail ? ` - ${detail}` : text ? ` - ${text}` : "";
             throw new Error(`Failed to send message: ${res.status}${suffix}`);
         }
     } catch (err) {
         console.error("Error sending message via REST:", err);
         throw err;
     }
  },

  updateConversation: async (conversationId: number | string, data: Partial<Conversation> & { product_id?: string | number }): Promise<void> => {
    try {
        // Backend expects product_id to update the context
        const body: Record<string, unknown> = {};
        if (data.product_id) body.product_id = data.product_id;
        
        // If there are other fields to update, add them here
        
        if (Object.keys(body).length === 0) return;

        const res = await fetchWithAuth(`/api/chat/conversations/${conversationId}`, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            console.warn(`[chatService] Failed to update conversation ${conversationId}: ${res.status}`);
            // We don't throw here to avoid blocking the UI flow if this is just a context update
        }
    } catch (err) {
        console.error("[chatService] updateConversation error", err);
    }
  }
};
