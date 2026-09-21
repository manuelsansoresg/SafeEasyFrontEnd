export type MenuOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type MenuOrderFulfillmentType = "pickup" | "delivery";
export type MenuOrderPaymentMethod = "cash" | "online";
export type MenuOrderPaymentStatus = "pending" | "paid" | "failed";

export interface MenuOrderSettings {
  menu_id: number;
  supplier_id: number;
  accepts_orders: boolean;
  allows_pickup: boolean;
  allows_delivery: boolean;
  allow_guest_orders: boolean;
  allows_cash: boolean;
  allows_online_payment: boolean;
  mercadopago_linked: boolean;
  online_payment_available: boolean;
}

export interface MenuOrderSettingsUpdate {
  accepts_orders: boolean;
  allows_pickup: boolean;
  allows_delivery: boolean;
  allow_guest_orders: boolean;
  allows_cash: boolean;
  allows_online_payment: boolean;
}

export interface MenuOrderItemCreate {
  menu_item_id: number;
  variant_id?: number | null;
  quantity: number;
  notes?: string | null;
}

export interface MenuOrderCreatePayload {
  menu_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfillment_type: MenuOrderFulfillmentType;
  payment_method: MenuOrderPaymentMethod;
  delivery_address?: string | null;
  notes?: string | null;
  client_request_id?: string | null;
  items: MenuOrderItemCreate[];
}

export interface MenuOrderItem {
  id: number;
  menu_item_id: number | null;
  item_name: string;
  menu_item_variant_id: number | null;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  notes: string | null;
  line_total: number;
  created_at: string;
}

export interface MenuOrder {
  id: number;
  order_number: string;
  supplier_id: number;
  menu_id: number | null;
  menu_name: string;
  customer_user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfillment_type: MenuOrderFulfillmentType;
  delivery_address: string | null;
  notes: string | null;
  status: MenuOrderStatus;
  payment_method: MenuOrderPaymentMethod;
  payment_status: MenuOrderPaymentStatus;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  payment_checkout_url: string | null;
  paid_at: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: MenuOrderItem[];
}

export interface MenuOrderCreated extends MenuOrder {
  management_token: string;
}

export interface MenuOrderStatusUpdate {
  status: MenuOrderStatus;
  cancellation_reason?: string | null;
}
