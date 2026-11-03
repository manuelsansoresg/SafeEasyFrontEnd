import { importRequest } from '@/services/facebookImportService';

export type AIReason = 'ai_benefit_not_included' | 'ai_annual_quota_exhausted' | 'ai_subscription_disabled' | 'ai_generation_in_progress' | 'ai_rate_limited' | 'ai_temporarily_unavailable';
export type AIBalance = {
  allocation: number; consumed: number; reserved: number; available: number;
  period_start: string | null; period_end: string | null; renews_at: string | null;
  can_generate: boolean; reason_code: AIReason | null; message: string | null;
};
export type AIAvailability = { supplier_id: number; texts: AIBalance; images: AIBalance };
export const quotaMessage = (balance?: AIBalance): string => {
  if (!balance) return 'Estamos consultando las generaciones de tu negocio.';
  if (balance.can_generate) return '';
  const messages: Record<AIReason, string> = {
    ai_benefit_not_included: 'Tu plan no incluye estas generaciones. Puedes continuar sin IA.',
    ai_annual_quota_exhausted: 'Ya utilizaste las generaciones de este periodo. Puedes continuar con tu contenido actual.',
    ai_subscription_disabled: 'Necesitas una suscripción activa para generar con IA.',
    ai_generation_in_progress: 'Hay una generación en curso o pendiente de revisión. Tu contenido se conserva.',
    ai_rate_limited: 'Alcanzaste el límite temporal de solicitudes. Inténtalo más tarde.',
    ai_temporarily_unavailable: 'La IA no está disponible en este momento. Puedes continuar sin IA.',
  };
  return balance.reason_code ? messages[balance.reason_code] || messages.ai_temporarily_unavailable : messages.ai_temporarily_unavailable;
};
export async function getAIAvailability(supplierId: number, signal?: AbortSignal) {
  const result = await importRequest<AIAvailability>(`/suppliers/${supplierId}/ai-availability`, { signal }, '/api');
  if (!result || result.supplier_id !== supplierId || ![result.texts, result.images].every(balance => balance && typeof balance.can_generate === 'boolean' && [balance.allocation, balance.consumed, balance.reserved, balance.available].every(value => Number.isSafeInteger(value) && value >= 0))) {
    throw new Error('No pudimos verificar las generaciones disponibles de este negocio.');
  }
  return result;
}
