export type SupportConversationStatus = "open" | "resolved" | "closed";

export interface SupportConversation {
  id: string;
  user_id: number;
  user_name: string | null;
  admin_id: number | null;
  admin_name: string | null;
  subject: string;
  status: SupportConversationStatus;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: number;
  sender_name: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type SupportSocketEvent =
  | {
      type: "support_new_message";
      conversation_id: string;
      message_id: string;
      content_preview: string;
      created_at: string;
    }
  | {
      type: "support_conversation_updated";
      conversation_id: string;
      last_message: string;
      updated_at: string;
      unread_count: number;
    }
  | {
      type: "support_conversation_resolved";
      conversation_id: string;
      resolved_at: string;
    }
  | {
      type: "support_conversation_closed";
      conversation_id: string;
      closed_at: string;
    }
  | {
      type: "support_conversation_claimed";
      conversation_id: string;
      admin_id: number;
      admin_name: string | null;
    }
  | { type: "pong" };
