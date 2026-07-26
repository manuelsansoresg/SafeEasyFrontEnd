export interface SupplierDirectoryRating {
  id: number;
  rating: number;
  comment: string | null;
  user_name: string;
  created_at: string;
}

export interface SupplierDirectoryRatingsResponse {
  supplier_slug: string;
  average: number;
  total: number;
  ratings: SupplierDirectoryRating[];
  my_rating: SupplierDirectoryRating | null;
}
