export type PlanDuration = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "expired" | "cancelled";
export type SubscriptionAssignmentType =
  | "courtesy"
  | "external_payment"
  | "migration"
  | "support"
  | "other";

export interface Plan {
  id: number;
  title: string;
  description?: string;
  price: number;
  features?: string[];
  duration: PlanDuration;
  is_active: boolean;
  is_listed?: boolean;
  is_renewable?: boolean;
  is_demo?: boolean;
  is_directory?: boolean;
  allowed_once_per_supplier?: boolean;
  access_code?: string | null;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
  max_gallery_images?: number | null;
  created_at?: string;
}

export interface Subscription {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: SubscriptionStatus;
  plan_id: number;
  start_date?: string;
  end_date: string;
  plan: Plan;
}

export interface SubscriptionHistoryEntry {
  id: number;
  subscription_id: number;
  supplier_id?: number | null;
  admin_user_id?: number | null;
  admin_name?: string | null;
  action?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  previous_plan_id?: number | null;
  new_plan_id?: number | null;
  previous_start_date?: string | null;
  new_start_date?: string | null;
  previous_end_date?: string | null;
  new_end_date?: string | null;
  assignment_type?: SubscriptionAssignmentType | null;
  note: string;
  created_at: string;
}

export interface ManualSubscriptionPayload {
  supplier_id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  assignment_type: SubscriptionAssignmentType;
  note: string;
  status?: SubscriptionStatus;
}

export interface UpdateManualSubscriptionPayload {
  status?: SubscriptionStatus;
  start_date?: string;
  end_date?: string;
  assignment_type: SubscriptionAssignmentType;
  note: string;
  plan_id?: number;
}

export interface SupplierSubscriptionOption {
  id: number;
  name: string;
  short_name?: string;
  user_email?: string;
}

export interface PurchaseResponse {
  init_point?: string;
  sandbox_init_point?: string;
  preference_id?: string;
  subscription_payment_id?: number;
  id?: number;
  status?: string;
  message?: string;
}
