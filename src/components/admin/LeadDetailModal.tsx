"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import { leadsService, type Lead, type LeadUpdate, type LeadStatus, type LeadPlan } from "@/services/leads";
import { formatLeadDate, labelFor, leadInterests, leadPlans, leadStatuses, whatsappUrl } from "@/components/admin/leadUtils";

interface Props {
  leadId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormFields = Pick<Lead, "name" | "phone" | "business_name" | "status" | "recommended_plan" | "notes">;

const inputClass = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function LeadDetailModal({ leadId, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { data: lead, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "leads", "detail", leadId],
    queryFn: () => leadsService.get(leadId!),
    enabled: leadId !== null,
    retry: false,
  });
  const [draft, setDraft] = useState<{ id: number; values: FormFields } | null>(null);
  const [formError, setFormError] = useState("");
  const form: FormFields | null = lead
    ? draft?.id === lead.id ? draft.values : {
      name: lead.name, phone: lead.phone, business_name: lead.business_name,
      status: lead.status, recommended_plan: lead.recommended_plan, notes: lead.notes,
    }
    : null;
  const setForm = (values: FormFields) => setDraft({ id: lead!.id, values });
  const close = useCallback(() => {
    setDraft(null);
    setFormError("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (leadId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [leadId, close]);

  const mutation = useMutation({
    mutationFn: (changes: LeadUpdate) => leadsService.update(leadId!, changes),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["admin", "leads", "detail", leadId], updated);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "leads", "list"] });
      onSaved();
    },
  });

  if (leadId === null) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead || !form) return;
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone) {
      setFormError("Completa el nombre y el WhatsApp.");
      return;
    }
    if (!/^[+0-9()\s-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15) {
      setFormError("Captura un WhatsApp válido de 7 a 15 dígitos.");
      return;
    }
    if (name.length > 150 || (form.business_name?.trim().length ?? 0) > 150 || (form.notes?.length ?? 0) > 10000) {
      setFormError("Algún campo supera la longitud permitida.");
      return;
    }
    const changes: LeadUpdate = {};
    if (name !== lead.name) changes.name = name;
    if (phone !== lead.phone) changes.phone = phone;
    const businessName = form.business_name?.trim() || null;
    if (businessName !== lead.business_name) changes.business_name = businessName;
    if (form.status !== lead.status) changes.status = form.status;
    if (form.recommended_plan !== lead.recommended_plan) changes.recommended_plan = form.recommended_plan;
    const notes = form.notes?.trim() || null;
    if (notes !== lead.notes) changes.notes = notes;
    if (Object.keys(changes).length === 0) {
      setFormError("No hay cambios por guardar.");
      return;
    }
    setFormError("");
    mutation.mutate(changes);
  };

  const tracking = lead ? [
    ["Landing", lead.landing_path], ["Fuente", lead.utm_source], ["Medio", lead.utm_medium],
    ["Campaña", lead.utm_campaign], ["Contenido", lead.utm_content], ["Término", lead.utm_term],
    ["gclid", lead.gclid], ["fbclid", lead.fbclid], ["Referente", lead.referrer],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])) : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">Prospecto #{leadId}</p>
            <h2 id="lead-detail-title" className="mt-1 font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]">{lead?.name ?? "Detalle del prospecto"}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar detalle" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {isPending ? <div className="flex items-center justify-center gap-2 py-16 text-gray-500"><Loader2 size={20} className="animate-spin" /> Cargando prospecto...</div> : null}
          {isError ? <div className="py-12 text-center"><p role="alert" className="text-gray-700">No se pudo cargar el prospecto.</p><button type="button" onClick={() => void refetch()} className="mt-3 font-semibold text-primary hover:underline">Reintentar</button></div> : null}
          {lead && form ? <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f2f3f4] p-4">
              <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-500">Interés</p><p className="font-semibold text-[#004e28]">{labelFor(leadInterests, lead.interest)}</p></div>
              <a href={whatsappUrl(lead.phone, lead.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#127500]"><ExternalLink size={16} /> Contactar por WhatsApp</a>
            </div>
            <form id="lead-edit-form" onSubmit={submit} className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">Nombre<input className={inputClass} value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
                <label className="text-sm font-medium text-gray-700">WhatsApp<input className={inputClass} value={form.phone} type="tel" onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></label>
                <label className="text-sm font-medium text-gray-700">Negocio<input className={inputClass} value={form.business_name ?? ""} maxLength={150} onChange={(event) => setForm({ ...form, business_name: event.target.value })} placeholder="—" /></label>
                <label className="text-sm font-medium text-gray-700">Estado<select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeadStatus })}>{leadStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="text-sm font-medium text-gray-700">Plan recomendado<select className={inputClass} value={form.recommended_plan} onChange={(event) => setForm({ ...form, recommended_plan: event.target.value as LeadPlan })}>{leadPlans.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <div className="text-sm text-gray-700"><p className="font-medium">Fechas</p><p className="mt-1">Creado: {formatLeadDate(lead.created_at)}</p><p>Actualizado: {formatLeadDate(lead.updated_at)}</p></div>
              </div>
              <label className="block text-sm font-medium text-gray-700">Notas internas<textarea className={`${inputClass} min-h-28 resize-y`} value={form.notes ?? ""} maxLength={10000} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Agrega información útil sobre este prospecto..." /></label>
              {tracking.length > 0 ? <section className="rounded-xl border border-gray-100 bg-gray-50 p-4"><h3 className="text-sm font-semibold text-[#004e28]">Origen del prospecto</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{tracking.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-gray-500">{label}</dt><dd className="break-words font-medium text-gray-800">{value}</dd></div>)}</dl></section> : null}
              {formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}
              {mutation.isError ? <p role="alert" className="text-sm text-red-600">{mutation.error instanceof Error ? mutation.error.message : "No se pudieron guardar los cambios."}</p> : null}
            </form>
          </> : null}
        </div>
        {lead && form ? <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 sm:px-6"><button type="button" onClick={close} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cerrar</button><button type="submit" form="lead-edit-form" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">{mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Guardar cambios</button></footer> : null}
      </section>
    </div>
  );
}
