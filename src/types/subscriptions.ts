export type PlanDuration = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "expired";

export interface Plan {
  id: number;
  title: string;
  description?: string;
  price: number;
  features?: string[];
  duration: PlanDuration;
  is_active: boolean;
  created_at?: string;
}

export interface Subscription {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: SubscriptionStatus;
  plan_id: number;
  end_date: string;
  plan: Plan;
}

export type SubscriptionEventStatus =
  | "purchase_pending"
  | "activated"
  | "expired"
  | "active";

export interface SubscriptionEvent {
  id: number;
  subscription_id: number;
  status: SubscriptionEventStatus;
  note: string;
  created_at: string;
}

export interface UpdateSubscriptionStatusPayload {
  status: SubscriptionStatus;
  note?: string;
  plan_id?: number;
  end_date?: string;
}

export interface PurchaseResponse {
  init_point?: string;
  preference_id?: string;
  subscription_payment_id?: number;
  id?: number;
  status?: string;
  message?: string;
}
