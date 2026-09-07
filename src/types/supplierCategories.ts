export interface DrooopySubcategory {
  id: number;
  category_id: number;
  name: string;
  slug?: string;
  is_active?: boolean;
}

export interface DrooopyCategory {
  id: number;
  name: string;
  slug?: string;
  is_active?: boolean;
  subcategories?: DrooopySubcategory[];
}

export interface SupplierSubcategory {
  id: number;
  supplier_category_id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierCategory {
  id: number;
  supplier_id: number;
  name: string;
  category_id: number;
  subcategory_id: number | null;
  is_active: boolean;
  category?: DrooopyCategory | null;
  subcategory?: DrooopySubcategory | null;
  global_category?: DrooopyCategory | null;
  global_subcategory?: DrooopySubcategory | null;
  subcategories: SupplierSubcategory[];
  created_at?: string;
  updated_at?: string;
}

export type SupplierClassification = {
  categoryId: number | null;
  subcategoryId: number | null;
  supplierCategoryId: number | null;
  supplierSubcategoryId: number | null;
};

export interface CreateSupplierCategoryInput {
  supplier_id: number;
  name: string;
  category_id: number;
  subcategory_id?: number | null;
}

export interface UpdateSupplierCategoryInput {
  name?: string;
  is_active?: boolean;
  category_id?: number;
  subcategory_id?: number | null;
}

export interface SupplierSubcategoryInput {
  name: string;
  is_active?: boolean;
}

export type UpdateSupplierSubcategoryInput = Partial<SupplierSubcategoryInput>;
