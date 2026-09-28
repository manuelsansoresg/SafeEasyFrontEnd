import type { BusinessHour, Supplier } from "@/lib/products";

export const SITE_BUILDER_UPDATE = "DROOOPY_PREVIEW_UPDATE";
export const SITE_BUILDER_READY = "DROOOPY_PREVIEW_READY";

export type SiteBuilderSection =
  | "general"
  | "appearance"
  | "header"
  | "information"
  | "hours"
  | "contact"
  | "social"
  | "sections"
  | "footer";

export type SiteBuilderDevice = "mobile" | "tablet" | "desktop";

export type SiteBuilderDraft = Supplier & {
  logo_url?: string | null;
  email?: string | null;
  page_background_color?: string;
  card_background_color?: string;
  header_background_color?: string;
};

export type SiteBuilderPreviewMessage = {
  type: typeof SITE_BUILDER_UPDATE;
  payload: Partial<SiteBuilderDraft> & { business_hours?: BusinessHour[] };
  activeSection: SiteBuilderSection | null;
};
