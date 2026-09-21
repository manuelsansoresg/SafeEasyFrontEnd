export type ModuleAvailability = "all" | "selected";

export type ModuleBillingPeriod = "monthly" | "yearly" | "one_time";

export type SupplierModuleStatus =
  | "pending"
  | "active"
  | "expired"
  | "cancelled";

export interface ModuleAdminList {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  has_price: boolean;
  price: number | null;
  billing_period: ModuleBillingPeriod | null;
  availability: ModuleAvailability;
  display_order: number;
  linked_plans_count: number;
  allowed_suppliers_count: number;
  assigned_suppliers_count: number;
  created_at: string;
  updated_at: string;
}

export interface ModuleAdminDetail extends ModuleAdminList {
  plan_ids: number[];
  specific_supplier_id: number | null;
  allowed_supplier_ids: number[];
}

export interface ModuleCreatePayload {
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  has_price: boolean;
  price: number | null;
  billing_period: ModuleBillingPeriod | null;
  /** Campo legacy que el backend conserva por compatibilidad. */
  availability: ModuleAvailability;
  display_order: number;
  plan_ids: number[];
  specific_supplier_id?: number | null;
}

export interface ModuleUpdatePayload {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  has_price?: boolean;
  price?: number | null;
  billing_period?: ModuleBillingPeriod | null;
  availability?: ModuleAvailability;
  display_order?: number;
  plan_ids?: number[];
  specific_supplier_id?: number | null;
}

export interface SupplierModuleAssignment {
  id: number;
  supplier_id: number;
  module_id: number;
  status: SupplierModuleStatus;
  effective_status: SupplierModuleStatus;
  is_enabled: boolean;
  starts_at: string | null;
  expires_at: string | null;
  price_paid: number | null;
  billing_period: ModuleBillingPeriod | null;
  has_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierModuleCatalogItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  has_price: boolean;
  price: number | null;
  billing_period: ModuleBillingPeriod | null;
  display_order: number;
  offered: boolean;
  included_by_plan: boolean;
  specific_supplier_offer: boolean;
  eligible_plan_id: number | null;
  payment_required: boolean;
  can_activate: boolean;
  has_access: boolean;
  assignment: SupplierModuleAssignment | null;
}

/** Alias mantenido para no romper useSupplierModules y pantallas existentes. */
export type SupplierModule = SupplierModuleCatalogItem;

export interface ModulePurchaseResponse {
  init_point: string;
  sandbox_init_point: string | null;
  preference_id: string | null;
  module_payment_id: number;
}

export interface ModulePayment {
  id: number;
  supplier_id: number;
  module_id: number;
  amount: number;
  status: string;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  period_start: string;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierModuleGrantPayload {
  status: SupplierModuleStatus;
  is_enabled: boolean;
  starts_at: string | null;
  expires_at: string | null;
  price_paid: number | null;
  billing_period: ModuleBillingPeriod | null;
}

export interface SupplierSummary {
  id: number;
  name: string;
  short_name?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_active?: boolean;
  user_id?: number;
  user_email?: string | null;
  email?: string | null;
}
