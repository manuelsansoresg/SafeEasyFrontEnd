export interface SupplierGalleryImage {
  id: number;
  supplier_id: number;
  image_url: string;
  thumbnail_url: string;
  position: number;
  created_at: string;
}

export interface SupplierGalleryUploadResult {
  uploaded: SupplierGalleryImage[];
  total: number;
  limit: number | null;
}
