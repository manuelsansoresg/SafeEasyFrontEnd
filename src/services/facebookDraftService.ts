import { importRequest, type ImportFields, type FieldKey, type BusinessHour, type Crop } from '@/services/facebookImportService';
export type TextField = 'short_description' | 'description' | 'title_about' | 'subtitle_about' | 'about';
export type Step = 'page' | 'information' | 'images' | 'review';
export type Asset = { id: string; kind: 'logo' | 'banner'; source: 'facebook' | 'upload' | 'ai'; path: string; width: number; height: number };
export type Operation = { operation_id: string; quota_refresh_url?: string | null; kind: 'texts' | 'logo' | 'banner'; status: 'processing' | 'succeeded' | 'failed' | 'unknown'; message: string; proposal: Partial<Record<TextField, string>> | null; asset: Asset | null; pending_fields: { field: string; question: string; reason: string }[]; warnings: string[] };
export type Edits = { step: Step; reviewed_fields: ImportFields; selected_fields: FieldKey[]; text_selections: Partial<Record<TextField, { source: 'original' | 'reviewed' | 'proposal'; operation_id?: string }>>; clear_fields: string[]; clear_hour_days: number[]; business_hours: BusinessHour[] | null; hours_source: 'original' | 'reviewed'; save_hours: boolean; logo: { action: 'keep' | 'skip' | 'import'; asset_id?: string | null; crop?: Crop | null }; banner: Edits['logo'] };
export type Draft = { id: string; supplier_id: number; status: string; version: number; expires_at: string; edits: Edits; original: { fields?: ImportFields; business_hours?: BusinessHour[]; warnings?: string[] }; assets: Asset[]; operations: Operation[]; supplier_revision: string; supplier_changed: boolean; source: { type: string; page_id?: string; current_supplier: ImportFields & { logo?: string; header_image?: string; banner?: string } }; confirmation: unknown };
export type DraftSummary = Pick<Draft, 'id' | 'supplier_id' | 'status' | 'version' | 'expires_at'>;
export const draftRequest = <T>(path = '', options: RequestInit = {}) => importRequest<T>(path, options, '/api/integrations/facebook/drafts');
export function fieldValue(draft: Draft, edits: Edits, field: FieldKey): string | number {
  const selection = edits.text_selections[field as TextField];
  if (selection?.source === 'proposal') return draft.operations.find(o => o.operation_id === selection.operation_id)?.proposal?.[field as TextField] ?? '';
  if (selection?.source === 'original') return draft.original.fields?.[field] ?? '';
  return edits.reviewed_fields[field] ?? draft.original.fields?.[field] ?? '';
}
