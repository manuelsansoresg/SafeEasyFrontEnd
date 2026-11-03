'use client';

import { Images, RefreshCw, Sparkles, Type } from 'lucide-react';
import type { AIBalance, AIAvailability } from '@/services/aiQuotaService';
import { quotaMessage } from '@/services/aiQuotaService';
import { useAIAvailability } from '@/hooks/useAIAvailability';

const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : null;
export function AIAllowancePanel({ data, loading, error, refreshing, refresh }: { data?: AIAvailability; loading: boolean; error: boolean; refreshing: boolean; refresh: () => void }) {
  return <section aria-label="Generaciones de inteligencia artificial" className="overflow-hidden rounded-2xl border border-[#004e28]/15 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#004e28]/10 bg-[#f4f8f5] px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#004e28] text-white"><Sparkles size={18} aria-hidden="true" /></span><div><h2 className="text-base font-semibold text-[#004e28]">Tu IA incluida</h2><p className="mt-0.5 text-xs text-gray-600">Generaciones anuales compartidas por tu negocio.</p></div></div><button type="button" disabled={refreshing || loading} onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#004e28]/20 bg-white px-3 text-xs font-medium text-[#004e28] transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-[#168e00] disabled:opacity-60"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />Actualizar</button></div>
    {error ? <p role="alert" className="p-5 text-sm text-amber-900">No pudimos consultar tus generaciones. Pulsa «Actualizar». Puedes seguir editando y guardar sin IA.</p> : !data || loading ? <div role="status" className="grid gap-4 p-5 sm:grid-cols-2">{['Textos', 'Imágenes'].map(label => <div key={label} className="space-y-3 rounded-xl bg-[#f2f3f4] p-4"><p className="text-sm text-[#004e28]">{label}</p><div className="h-7 w-24 animate-pulse rounded bg-gray-200" /><span className="sr-only">Consultando generaciones disponibles</span></div>)}</div> : <div className="grid gap-5 p-5 sm:grid-cols-2"><BalanceCard balance={data.texts} kind="texts" /><BalanceCard balance={data.images} kind="images" /></div>}
    <p className="border-t border-gray-100 px-5 py-3 text-xs leading-5 text-gray-500">Editar, importar y guardar no consume generaciones. Los cambios de texto e imagen se revisan antes de publicarse.</p>
  </section>;
}
function BalanceCard({ balance, kind }: { balance: AIBalance; kind: 'texts' | 'images' }) {
  const Icon = kind === 'texts' ? Type : Images;
  const renewal = dateLabel(balance.renews_at);
  const progress = balance.allocation > 0 ? Math.min(100, Math.max(0, (balance.consumed + balance.reserved) / balance.allocation * 100)) : 0;
  return <div className="min-w-0"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-medium text-[#004e28]"><Icon size={16} aria-hidden="true" />{kind === 'texts' ? 'Textos' : 'Imágenes'}</p><p className="mt-1 text-xs text-gray-500">{kind === 'texts' ? 'Una generación puede completar varios campos.' : 'Un mismo saldo para tu logo y banner.'}</p></div><span className="shrink-0 rounded-full bg-[#edf6ef] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#004e28]">Anual</span></div><p className="mt-4 flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums text-[#004e28]">{balance.available}</strong><span className="text-xs text-gray-600">disponibles de {balance.allocation}</span></p><div role="progressbar" aria-label={`${kind === 'texts' ? 'Textos utilizados o reservados' : 'Imágenes utilizadas o reservadas'}`} aria-valuemin={0} aria-valuemax={Math.max(1, balance.allocation)} aria-valuenow={Math.min(balance.allocation, balance.consumed + balance.reserved)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf0ed]"><div style={{ width: `${progress}%` }} className={`h-full rounded-full ${balance.available === 0 ? 'bg-amber-500' : 'bg-[#168e00]'}`} /></div><p className="mt-2 text-xs text-gray-500">{balance.consumed} utilizadas{balance.reserved > 0 ? ` · ${balance.reserved} ${balance.reserved === 1 ? 'pendiente' : 'pendientes'}` : ''}{renewal ? ` · Renovación: ${renewal}` : ''}</p>{!balance.can_generate && <p className="mt-3 rounded-lg bg-[#f2f3f4] p-3 text-xs leading-5 text-gray-700">{quotaMessage(balance)}</p>}</div>;
}
export function BusinessAIAllowance({ supplierId }: { supplierId: number }) {
  const quota = useAIAvailability(supplierId);
  return <AIAllowancePanel data={quota.data} loading={quota.isPending} error={quota.isError} refreshing={quota.isFetching} refresh={() => void quota.refetch()} />;
}
export function AIGenerationHint({ balance, error, images = false }: { balance?: AIBalance; error: boolean; images?: boolean }) {
  return <p className={`mt-2 text-xs leading-5 ${error || (balance && !balance.can_generate) ? 'text-amber-900' : 'text-gray-600'}`} role="status">{error ? 'No pudimos verificar tu cuota. Actualízala arriba para generar.' : !balance || !balance.can_generate ? quotaMessage(balance) : `Utiliza 1 generación de ${images ? 'imagen' : 'textos'} · Te quedan ${balance.available}.${images ? ' Logo y banner comparten este saldo.' : ''}`}</p>;
}
