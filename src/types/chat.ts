export interface Message {
  id: string | number;
  conversation_id: string | number;
  sender_id: number;
  buyer_id?: number;
  supplier_id?: number;
  content: string;
  created_at: string;
  is_read: boolean;
  message_type?: 'text' | 'image' | 'system' | 'file';
  attachment_url?: string;
  product_id?: string | number | null;
  product?: {
    id: string | number;
    title: string;
    image: string;
    price: number;
    slug: string;
  };
}

export interface Conversation {
  id: string | number;
  user_id: number;
  buyer_id?: number; // Backend field
  supplier_id: number;
  /**
   * Backend field. The actual user_id of the supplier who owns this conversation
   * (different from `supplier_id` which is the supplier COMPANY/record id).
   * Required for the client-side role fallback when `my_role` is missing.
   */
  supplier_user_id?: number | null;
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
  supplier_slug?: string;
  supplier_transfer_data?: {
      transfer_clabe?: string | null;
      transfer_bank?: string | null;
      transfer_name?: string | null;
      transfer_accepted?: boolean;
  };
  product_title?: string;
  product_image?: string;
  product_price?: number;
  product_slug?: string;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    image?: string;
    avatar?: string;
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
  message_type?: 'text' | 'image' | 'file';
}

export type AgendaInboxEventType =
  | "agenda.booking_created"
  | "agenda.booking_cancelled"
  | "agenda.booking_rescheduled"
  | "agenda.reschedule_requested"
  | "agenda.reschedule_decided"
  | "agenda.booking_status_changed"
  | "agenda.payment_received";

export type AgendaInboxEvent = {
  type: AgendaInboxEventType;
  booking_id: number;
  supplier_id: number;
  status?: string;
  reschedule_status?: string;
};

const agendaInboxEventTypes = new Set<AgendaInboxEventType>([
  "agenda.booking_created",
  "agenda.booking_cancelled",
  "agenda.booking_rescheduled",
  "agenda.reschedule_requested",
  "agenda.reschedule_decided",
  "agenda.booking_status_changed",
  "agenda.payment_received",
]);

export function isAgendaInboxEvent(event: ChatInboxEvent): event is AgendaInboxEvent {
  const record = event as Record<string, unknown>;
  return (
    agendaInboxEventTypes.has(record.type as AgendaInboxEventType) &&
    typeof record.booking_id === "number" &&
    Number.isFinite(record.booking_id) &&
    typeof record.supplier_id === "number"
  );
}

export type MenuInboxEvent = {
  type: "menu.order_created" | "menu.order_status_changed" | "menu.order_payment_changed";
  order_id: number;
  supplier_id: number;
  status: string;
  payment_status: string;
};

export function isMenuInboxEvent(event: ChatInboxEvent): event is MenuInboxEvent {
  const record = event as Record<string, unknown>;
  return (
    (record.type === "menu.order_created" ||
      record.type === "menu.order_status_changed" ||
      record.type === "menu.order_payment_changed") &&
    typeof record.order_id === "number" &&
    Number.isInteger(record.order_id) &&
    typeof record.supplier_id === "number" &&
    Number.isInteger(record.supplier_id)
  );
}

export type ChatInboxEvent =
  | { type: "presence_ack"; status: "online" | "away" | "offline" | string }
  | { type: "unread_aggregate"; total_unread: number }
  | { type: "notification.created" }
  | {
      type: "conversation_updated";
      conversation_id: string | number;
      last_message?: string;
      unread_count?: number;
      created_at?: string;
      updated_at?: string;
    }
  | {
      type: "new_message";
      conversation_id: string | number;
      message_id?: string | number;
      content_preview?: string;
      created_at?: string;
    }
  | AgendaInboxEvent
  | MenuInboxEvent
  | Record<string, unknown>;
