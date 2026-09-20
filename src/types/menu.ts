export type MenuDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface MenuItem {
  id: number;
  section_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  price: number | null;
  old_price: number | null;
  label: string | null;
  is_active: boolean;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuSection {
  id: number;
  menu_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  items: MenuItem[];
}

export interface Menu {
  id: number;
  supplier_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  price: number | null;
  date_start: string | null;
  date_end: string | null;
  days_of_week: MenuDay[] | null;
  time_start: string | null;
  time_end: string | null;
  is_active: boolean;
  display_order: number;
  setup_step: number;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
  sections: MenuSection[];
}

export interface MenuCreatePayload {
  name: string;
  description: string | null;
  price: number | null;
  date_start: string | null;
  date_end: string | null;
  days_of_week: MenuDay[] | null;
  time_start: string | null;
  time_end: string | null;
  is_active: boolean;
  display_order: number;
  wizard_mode?: boolean;
}

export type MenuUpdatePayload = Partial<
  Omit<MenuCreatePayload, "wizard_mode">
>;

export interface MenuSectionPayload {
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface MenuItemPayload {
  name: string;
  description: string | null;
  price: number | null;
  old_price: number | null;
  label: string | null;
  is_active: boolean;
  is_available: boolean;
  display_order: number;
}

export interface MenuCatalogItem {
  id: number;
  supplier_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  price: number | null;
  old_price: number | null;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuCatalogItemCreatePayload {
  name: string;
  description: string | null;
  price: number | null;
  old_price: number | null;
  label: string | null;
  is_active: boolean;
}

export type MenuCatalogItemUpdatePayload = Partial<
  MenuCatalogItemCreatePayload
>;

export interface MenuSectionItemAttachPayload {
  item_id: number;
  is_active: boolean;
  is_available: boolean;
  display_order: number;
}

export interface MenuSectionItemBulkAttachPayload {
  items: MenuSectionItemAttachPayload[];
}
