'use client';
import { useRef, useState } from 'react';
import AgendaModalShell from '@/components/agenda/AgendaModalShell';
import { standardPolicyAuthorized } from '@/lib/agendaFinance';
import { agendaService } from '@/services/agendaService';
import type { StandardCancellationPolicy } from '@/types/agendaFinance';

export default function AgendaStandardPolicyConsent({ policy, error, onRefresh, noticeHours }: {
  policy: StandardCancellationPolicy | null; error?: string; onRefresh: () => Promise<void>; noticeHours?: number;
}) {
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const lock = useRef(false);
  const accept = async () => {
    if (lock.current || !checked || !policy?.approved || !policy.policy_available || !policy.version || !policy.content_hash) return;
    lock.current = true; setWorking(true); setActionError('');
    try {
      await agendaService.acceptStandardCancellationPolicy({ version: policy.version, content_hash: policy.content_hash, accepted: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo confirmar la aceptación.');
    } finally {
      setChecked(false);
      await onRefresh();
      setWorking(false); lock.current = false;
    }
  };
  if (standardPolicyAuthorized(policy)) return <p role="status" className="rounded-xl bg-[#168e00]/5 p-3 text-sm font-semibold text-[#004e28]">Condiciones de cancelación aceptadas.</p>;
  if (!policy || error) return <div className="rounded-xl bg-[#f2f3f4] p-4 text-sm"><p>{error || 'Consultando condiciones de cancelación…'}</p>{error ? <button type="button" className="mt-2 min-h-11 font-semibold text-[#168e00] underline" onClick={() => void onRefresh()}>Volver a consultar</button> : null}</div>;
  if (!policy.policy_available || !policy.approved) return null; // The editor already explains pending protection.
  return <section className="space-y-3 rounded-2xl border border-[#004e28]/15 bg-white p-4">
    <h3 className="font-bold text-[#004e28]">Condiciones de cancelación de Drooopy</h3>
    <p className="text-sm text-gray-600">Drooopy establece las condiciones de cancelación para proteger tu negocio y explicar a tus clientes cuándo se devuelve o conserva un anticipo.</p>
    <button type="button" className="min-h-11 text-sm font-semibold text-[#168e00] underline" onClick={() => setOpen(true)}>Consultar condiciones de cancelación</button>
    <p className="text-xs text-gray-600">Tu aceptación cubre estas condiciones y el plazo que configures en Agenda.</p>
    <label className="flex gap-3 text-sm"><input type="checkbox" disabled={working} className="size-5 shrink-0 accent-[#168e00]" checked={checked} onChange={e => setChecked(e.target.checked)} />He leído y acepto las condiciones de cancelación.</label>
    <button type="button" disabled={!checked || working || !policy.version || !policy.content_hash} onClick={() => void accept()} className="min-h-12 w-full rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white disabled:opacity-40 sm:w-auto">{working ? 'Confirmando…' : 'Aceptar y continuar'}</button>
    {actionError ? <p role="alert" className="text-sm text-amber-900">{actionError}</p> : null}
    <AgendaModalShell open={open} title="Condiciones de cancelación de Drooopy" saving={working} hideSubmit cancelLabel="Volver" onClose={() => setOpen(false)} onSubmit={e => e.preventDefault()}>
      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{noticeHours === undefined ? policy.text_template : policy.text_template?.replaceAll('{cancellation_notice_hours}', String(noticeHours))}</p>
    </AgendaModalShell>
  </section>;
}
