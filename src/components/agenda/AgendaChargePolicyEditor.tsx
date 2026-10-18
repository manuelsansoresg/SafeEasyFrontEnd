'use client';
import { ChevronDown } from 'lucide-react';
import { isLegacyChargePolicy, mxn, policyExample, standardChargePolicy, standardPolicyAuthorized } from '@/lib/agendaFinance';
import type { ChargePolicy, StandardCancellationPolicy } from '@/types/agendaFinance';

export const offlinePolicy: ChargePolicy = { mode: 'offline' };
export default function AgendaChargePolicyEditor({ value, onChange, onlineAvailable = true, noticeHours, samplePrice, standardPolicy, onEditNotice }: {
  value: ChargePolicy; onChange: (value: ChargePolicy) => void; onlineAvailable?: boolean; noticeHours?: number; samplePrice?: number | null;
  standardPolicy?: StandardCancellationPolicy | null; onEditNotice?: () => void;
}) {
  const legacy = isLegacyChargePolicy(value);
  const example = samplePrice !== null && samplePrice !== undefined ? policyExample(String(samplePrice), value) : null;
  const deposit = value.mode === 'fixed' || value.mode === 'percentage';
  const authorized = standardPolicyAuthorized(standardPolicy);
  const field = 'mt-2 block min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10';
  const selectClass = 'h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';
  return <fieldset className="space-y-4 rounded-2xl border border-[#004e28]/15 bg-white p-4 text-sm">
    <legend className="px-2 font-bold text-[#004e28]">Cobro inicial y cancelaciones</legend>
    {legacy ? <div className="space-y-2 rounded-xl bg-[#f2f3f4] p-3">
      <p>Esta configuración conserva sus condiciones anteriores. Puedes mantenerlas o elegir las condiciones de Drooopy para futuras reservaciones.</p>
      {value.terms_text ? <details><summary className="cursor-pointer font-semibold text-[#004e28]">Consultar condiciones actuales</summary><p className="mt-2 whitespace-pre-wrap text-gray-600">{value.terms_text}</p></details> : null}
      <button type="button" onClick={() => onChange(standardChargePolicy(value))} className="min-h-11 rounded-xl border border-[#168e00] px-4 py-2 font-semibold text-[#004e28]">Usar condiciones de Drooopy</button>
    </div> : null}
    <label className="block">¿Cómo quieres cobrar al reservar?
      <span className="relative mt-2 block">
        <select disabled={legacy} className={selectClass} value={value.mode} onChange={e => {
          const mode = e.target.value as ChargePolicy['mode'];
          onChange(mode === 'percentage' ? { mode, percentage: value.percentage ?? '30' } : mode === 'fixed' ? { mode, fixed_amount: value.fixed_amount ?? '200.00' } : { mode });
        }}>
          <option value="offline">Sin anticipo / pago al asistir</option>
          <option value="full" disabled={!onlineAvailable}>Pago completo</option>
          <option value="percentage" disabled={!onlineAvailable}>Anticipo porcentual</option>
          <option value="fixed" disabled={!onlineAvailable}>Anticipo fijo</option>
        </select>
        <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
      </span>
    </label>
    {!onlineAvailable ? <p className="text-amber-900">El cobro inicial en línea requiere Mercado Pago vinculado, pagos en línea permitidos y autorización del módulo en tu plan.</p> : null}
    {value.mode === 'percentage' ? <label className="block">Porcentaje de anticipo<input disabled={legacy} required className={field} type="number" min="0.0001" max="100" step="0.0001" value={value.percentage ?? ''} onChange={e => onChange({ mode: 'percentage', percentage: e.target.value })} /></label> : null}
    {value.mode === 'fixed' ? <label className="block">Anticipo en MXN<input disabled={legacy} required className={field} type="number" min="0.01" max="9999999999.99" step="0.01" value={value.fixed_amount ?? ''} onChange={e => onChange({ mode: 'fixed', fixed_amount: e.target.value })} /></label> : null}
    {example ? <p className="rounded-xl bg-[#f2f3f4] p-3 text-sm">Ejemplo para un servicio de {mxn(example.total)}: pago inicial {mxn(example.initial)} y saldo previsto {mxn(example.remaining)}. Cada servicio puede tener un precio distinto; el importe definitivo se cotiza al reservar.</p> : null}
    <div className="flex flex-wrap items-center gap-2 text-gray-600"><p>{noticeHours === undefined ? 'Se aplica el plazo de cancelación configurado en Agenda.' : `Cancelaciones sin penalización hasta ${noticeHours} horas antes de la cita.`}</p>{onEditNotice ? <button type="button" onClick={onEditNotice} className="min-h-11 font-semibold text-[#168e00] underline underline-offset-2">Modificar plazo</button> : null}</div>
    {deposit && !legacy ? <div className="space-y-2 rounded-xl bg-[#004e28]/5 p-4">
      <h3 className="font-bold text-[#004e28]">Protección de tu anticipo</h3>
      <p className="text-sm text-gray-700">{authorized
        ? 'Si el cliente cancela fuera del plazo permitido o no se presenta, podrás conservar el anticipo conforme a las condiciones aceptadas. Si cancela a tiempo, se tramitará su devolución.'
        : standardPolicy?.approved && standardPolicy.policy_available
          ? 'Para habilitar la protección de anticipos, acepta las condiciones de cancelación de Drooopy en Pagos.'
          : 'La protección automática de anticipos está pendiente de habilitación por Drooopy.'}</p>
      {authorized ? <p className="text-xs text-gray-600">Solo aplica al anticipo confirmado y disponible, con aceptación del cliente y cuando las condiciones válidas lo permitan. Si cancela el negocio, se tramita la devolución; prevalecen las excepciones legales. Un pago completo no genera retención automática.</p> : null}
    </div> : null}
  </fieldset>;
}
