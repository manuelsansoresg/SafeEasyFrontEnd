export interface BusinessTypeCategory {
  id: number;
  name: string;
  slug?: string;
  is_active?: boolean;
}

export interface BusinessTypePublic {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  icon_url?: string | null;
}

export interface BusinessTypeAdminList {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  icon_url: string | null;
  categories_count: number;
  suppliers_count: number;
}

export interface BusinessTypeAdminDetail extends Omit<BusinessTypeAdminList, "categories_count"> {
  categories: BusinessTypeCategory[];
}

export type BusinessTypePayload = Pick<BusinessTypeAdminList, "name" | "is_active">;
