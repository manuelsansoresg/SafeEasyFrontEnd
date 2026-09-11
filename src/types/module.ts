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
  allowed_suppliers_count: number;
  assigned_suppliers_count: number;
  created_at: string;
  updated_at: string;
}

export interface ModuleAdminDetail extends ModuleAdminList {
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
  availability: ModuleAvailability;
  display_order: number;
}

export type ModuleUpdatePayload = Omit<ModuleCreatePayload, "code">;

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
