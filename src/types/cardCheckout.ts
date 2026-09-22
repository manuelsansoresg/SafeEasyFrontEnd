export type CardCheckoutDeliveryType = "pickup" | "shipping";

export type CardCheckoutItem = {
  product_id: string;
  quantity: number;
};

export type CardAuthorizationRequest = {
  items: CardCheckoutItem[];
  delivery_type: CardCheckoutDeliveryType;
  payment_method: "card";
  distance_km: number | null;
  card_token: string;
  payment_method_id: string;
  issuer_id: string | null;
  installments: 1;
};

export type CardAuthorizationDraft = Pick<
  CardAuthorizationRequest,
  "items" | "delivery_type" | "payment_method" | "distance_km"
>;

export type CardAuthorizationResponse = {
  checkout_id: string;
  order_id: number | null;
  payment_status: string;
  status_detail: string | null;
  mp_payment_id: string;
  authorization_expires_at: string | null;
};

export type CheckoutSessionStatus = {
  checkout_id: string;
  status: string;
  order_id: number | null;
  mp_payment_id: string | null;
  expires_at: string | null;
  remaining_seconds: number;
  can_continue_payment: boolean;
};

export type MercadoPagoCardData = {
  token: string;
  issuer_id?: string | number | null;
  payment_method_id: string;
  installments: number;
};
