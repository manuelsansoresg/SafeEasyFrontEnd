'use client';
import { useId } from 'react';
import { mxn, policyExample } from '@/lib/agendaFinance';
import type { ChargePolicy } from '@/types/agendaFinance';

export const offlinePolicy: ChargePolicy = { mode: 'offline', percentage: null, fixed_amount: null, retain_deposit: false, retention_authorized: false, terms_version: null, terms_text: null };
export default function AgendaChargePolicyEditor({ value, onChange, onlineAvailable = true, noticeHours, samplePrice }: {
  value: ChargePolicy; onChange: (value: ChargePolicy) => void; onlineAvailable?: boolean; noticeHours?: number; samplePrice?: number | null;
}) {
  const id = useId();
  const example = samplePrice !== null && samplePrice !== undefined ? policyExample(String(samplePrice), value) : null;
  const deposit = value.mode === 'fixed' || value.mode === 'percentage';
  const field = 'mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-black';
  return <fieldset className="space-y-4 rounded-2xl border border-[#004e28]/15 bg-white p-4 text-sm">
    <legend className="px-2 font-bold text-[#004e28]">Cobro inicial y cancelaciones</legend>
    <label className="block">Cómo cobrar al reservar
      <select className={field} value={value.mode} onChange={e => {
        const mode = e.target.value as ChargePolicy['mode'];
        onChange({ ...value, mode, percentage: mode === 'percentage' ? value.percentage ?? '30' : null, fixed_amount: mode === 'fixed' ? value.fixed_amount ?? '200.00' : null,
          ...(!['percentage', 'fixed'].includes(mode) ? { retain_deposit: false, retention_authorized: false, terms_version: null, terms_text: null } : {}) });
      }}>
        <option value="offline">Sin anticipo / pago al asistir</option>
        <option value="full" disabled={!onlineAvailable}>Pago completo</option>
        <option value="percentage" disabled={!onlineAvailable}>Anticipo porcentual (por ejemplo, 30 %)</option>
        <option value="fixed" disabled={!onlineAvailable}>Anticipo fijo (por ejemplo, $200)</option>
      </select>
    </label>
    {!onlineAvailable ? <p className="text-amber-900">El cobro inicial en línea requiere Mercado Pago vinculado, pagos en línea permitidos y autorización del módulo en tu plan.</p> : null}
    {value.mode === 'percentage' ? <label className="block">Porcentaje de anticipo<input required className={field} type="number" min="0.0001" max="100" step="0.0001" value={value.percentage ?? ''} onChange={e => onChange({ ...value, percentage: e.target.value })} /></label> : null}
    {value.mode === 'fixed' ? <label className="block">Anticipo en MXN<input required className={field} type="number" min="0.01" max="9999999999.99" step="0.01" value={value.fixed_amount ?? ''} onChange={e => onChange({ ...value, fixed_amount: e.target.value })} /></label> : null}
    {example ? <p className="rounded-xl bg-[#f2f3f4] p-3 text-sm">Ejemplo para un servicio de {mxn(example.total)}: pago inicial {mxn(example.initial)} y saldo previsto {mxn(example.remaining)}. Cada servicio puede tener un precio distinto; el importe definitivo se cotiza al reservar.</p> : null}
    <p className="text-gray-600">{noticeHours === undefined ? 'Se aplica el plazo de cancelación configurado en Agenda.' : `Plazo de cancelación con reembolso: ${noticeHours} horas antes de la cita.`}</p>
    {deposit ? <>
      <label className="flex gap-3"><input className="size-5 accent-[#168e00]" type="checkbox" checked={value.retain_deposit} onChange={e => onChange({ ...value, retain_deposit: e.target.checked, retention_authorized: false })} />Conservar el anticipo en cancelaciones fuera del plazo, cuando corresponda</label>
      {value.retain_deposit ? <>
        <label className="block" htmlFor={`${id}-terms`}>Condiciones de cancelación<textarea id={`${id}-terms`} required minLength={1} maxLength={6000} rows={5} className={field} value={value.terms_text ?? ''} onChange={e => onChange({ ...value, terms_text: e.target.value })} /></label>
        <label className="block">Versión de las condiciones<input className={field} required maxLength={80} value={value.terms_version ?? ''} onChange={e => onChange({ ...value, terms_version: e.target.value })} /></label>
        <label className="flex gap-3"><input required className="size-5 shrink-0 accent-[#168e00]" type="checkbox" checked={value.retention_authorized} onChange={e => onChange({ ...value, retention_authorized: e.target.checked })} />Declaro que estoy autorizado para aplicar estas condiciones y que he revisado su conformidad con la normativa aplicable.</label>
        <p className="text-xs text-gray-600">Las condiciones deben ser válidas conforme a la normativa aplicable. Configurarlas no certifica su validez jurídica. El cliente deberá aceptarlas expresamente.</p>
      </> : null}
    </> : null}
  </fieldset>;
}
