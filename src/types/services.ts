import type { DrooopyCategory, DrooopySubcategory, SupplierCategory, SupplierSubcategory } from "@/types/supplierCategories";

export interface ServiceImage {
  id: number;
  image_url: string;
  thumbnail_url: string;
  position: number;
  is_cover: boolean;
  created_at: string;
}

export interface SupplierService {
  id: string;
  supplier_id: number;
  title: string;
  description: string;
  price: number;
  is_active: boolean;
  images: ServiceImage[];
  created_at: string;
  updated_at: string;
  cover_image_url: string | null;
  cover_thumbnail_url: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  supplier_category_id: number | null;
  supplier_subcategory_id: number | null;
  category?: DrooopyCategory | null;
  subcategory?: DrooopySubcategory | null;
  supplier_category?: SupplierCategory | null;
  supplier_subcategory?: SupplierSubcategory | null;
}

export interface CreateServiceInput {
  supplierId: number;
  title: string;
  description: string;
  price: number;
  isActive: boolean;
  coverIndex?: number;
  images: File[];
  categoryId?: number | null;
  subcategoryId?: number | null;
  supplierCategoryId?: number | null;
  supplierSubcategoryId?: number | null;
}

export interface UpdateServiceInput {
  title?: string;
  description?: string;
  price?: number;
  is_active?: boolean;
  category_id?: number | null;
  subcategory_id?: number | null;
  supplier_category_id?: number | null;
  supplier_subcategory_id?: number | null;
}
