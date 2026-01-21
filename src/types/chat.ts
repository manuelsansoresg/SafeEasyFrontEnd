export interface Message {
  id: string | number;
  conversation_id: string | number;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  message_type?: 'text' | 'image' | 'system';
}

export interface Conversation {
  id: string | number;
  user_id: number;
  buyer_id?: number; // Backend field
  other_party_name?: string; // Backend field for display name
  supplier_id: number;
  product_id?: string | number | null;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  // Augmented fields for UI
  my_role?: 'client' | 'supplier'; // Backend field from new chat.md
  other_party_name?: string; // Backend field from new chat.md
  user_name?: string;
  buyer_name?: string; // Backend field from new chat.md
  user_image?: string;
  supplier_name?: string; // Backend field from new chat.md
  supplier_image?: string;
  product_title?: string;
  product_image?: string;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
  };
}

export interface CreateConversationParams {
  supplier_id: number;
  product_id?: string | number;
  initial_message?: string;
}

export interface SendMessageParams {
  conversation_id: number;
  content: string;
  message_type?: 'text' | 'image';
}
