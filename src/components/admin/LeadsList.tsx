"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, Search } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { LeadDetailModal } from "@/components/admin/LeadDetailModal";
import { formatLeadDate, labelFor, leadInterests, leadPlans, leadStatuses, whatsappUrl } from "@/components/admin/leadUtils";
import { leadsService, type Lead, type LeadInterest, type LeadStatus } from "@/services/leads";

const LIMIT = 20;
const selectClass = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-auto";

function StatusBadge({ status }: { status: LeadStatus }) {
  const color = status === "WON" ? "bg-[#168e00]/10 text-[#126d00]" : status === "LOST" ? "bg-gray-100 text-gray-600" : "bg-[#004e28]/8 text-[#004e28]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{labelFor(leadStatuses, status)}</span>;
}

function LeadActions({ lead, onView }: { lead: Lead; onView: (id: number) => void }) {
  return <div className="flex items-center gap-1 whitespace-nowrap">
    <button type="button" onClick={() => onView(lead.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-primary/5"><Eye size={16} /> Ver</button>
    <a href={whatsappUrl(lead.phone, lead.name)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${lead.name}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-[#168e00] hover:bg-[#168e00]/5"><ExternalLink size={16} /> WhatsApp</a>
  </div>;
}

export function LeadsList() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [interest, setInterest] = useState<LeadInterest | "">("");
  const [skip, setSkip] = useState(0);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSkip(0);
        setSearch(next);
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [searchInput, search]);

  useEffect(() => {
    if (!showSuccess) return;
    const id = window.setTimeout(() => setShowSuccess(false), 3500);
    return () => window.clearTimeout(id);
  }, [showSuccess]);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "leads", "list", search, status, interest, skip, LIMIT],
    queryFn: () => leadsService.list({ search: search || undefined, status: status || undefined, interest: interest || undefined, skip, limit: LIMIT }),
    retry: false,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(skip / LIMIT) + 1;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = Boolean(search || status || interest);

  return <div className="space-y-6">
    <PageHero title="Prospectos" subtitle="Gestiona las personas interesadas en utilizar Drooopy." />
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5" aria-label="Buscar y filtrar prospectos">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative block"><span className="sr-only">Buscar prospectos</span><Search size={18} className="absolute left-3 top-3 text-gray-400" /><input className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar por nombre, WhatsApp o negocio..." maxLength={100} /></label>
        <label className="block"><span className="sr-only">Filtrar por estado</span><select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value as LeadStatus | ""); setSkip(0); }}><option value="">Todos los estados</option>{leadStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="block"><span className="sr-only">Filtrar por interés</span><select className={selectClass} value={interest} onChange={(event) => { setInterest(event.target.value as LeadInterest | ""); setSkip(0); }}><option value="">Todos los intereses</option>{leadInterests.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-label="Listado de prospectos">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5"><h2 className="font-semibold text-[#004e28]">Listado</h2><span className="text-sm text-gray-500">{isFetching && !isPending ? "Actualizando..." : `${total} ${total === 1 ? "resultado" : "resultados"}`}</span></div>
      {isPending ? <div className="flex items-center justify-center gap-2 py-20 text-gray-500"><Loader2 className="animate-spin" size={20} /> Cargando prospectos...</div> : null}
      {isError ? <div className="px-5 py-16 text-center"><p role="alert" className="text-gray-700">{error instanceof Error ? error.message : "No se pudieron cargar los prospectos."}</p><button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary/5">Reintentar</button></div> : null}
      {!isPending && !isError && items.length === 0 ? <div className="px-5 py-16 text-center"><p className="font-semibold text-gray-800">{filtered ? "No se encontraron prospectos con estos filtros." : "No hay prospectos todavía."}</p>{!filtered ? <p className="mt-1 text-sm text-gray-500">Los prospectos que lleguen desde las campañas de Drooopy aparecerán aquí.</p> : null}</div> : null}
      {!isPending && !isError && items.length > 0 ? <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><thead className="bg-[#f2f3f4] text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Prospecto</th><th className="px-4 py-3">Negocio</th><th className="px-4 py-3">Interés</th><th className="px-4 py-3">Plan recomendado</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map((lead) => <tr key={lead.id} className="hover:bg-gray-50/70"><td className="px-5 py-4"><span className="block font-semibold text-gray-900">{lead.name}</span><span className="text-xs text-gray-500">{lead.phone}</span></td><td className="px-4 py-4 text-gray-700">{lead.business_name || "—"}</td><td className="px-4 py-4"><span className="rounded-full bg-[#f2f3f4] px-2.5 py-1 text-xs font-medium text-[#004e28]">{labelFor(leadInterests, lead.interest)}</span></td><td className="px-4 py-4 text-gray-700">{labelFor(leadPlans, lead.recommended_plan)}</td><td className="px-4 py-4"><StatusBadge status={lead.status} /></td><td className="px-4 py-4 text-gray-700">{lead.utm_source ? lead.utm_source.charAt(0).toLocaleUpperCase("es-MX") + lead.utm_source.slice(1) : "Directo"}</td><td className="px-4 py-4 whitespace-nowrap text-gray-600">{formatLeadDate(lead.created_at)}</td><td className="px-4 py-4"><LeadActions lead={lead} onView={setLeadId} /></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-gray-100 lg:hidden">{items.map((lead) => <article key={lead.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-gray-900">{lead.name}</h3><p className="text-sm text-gray-500">{lead.phone}</p></div><StatusBadge status={lead.status} /></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600"><span className="rounded-full bg-[#f2f3f4] px-2.5 py-1 font-medium text-[#004e28]">{labelFor(leadInterests, lead.interest)}</span><span>{formatLeadDate(lead.created_at)}</span></div><div className="mt-2 text-xs text-gray-500">{lead.business_name || "—"} · {lead.utm_source || "Directo"}</div><div className="mt-2"><LeadActions lead={lead} onView={setLeadId} /></div></article>)}</div>
      </> : null}
      {!isPending && !isError && total > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 sm:px-5"><p className="text-sm text-gray-500">Página {page} de {pageCount} · {total} {total === 1 ? "prospecto" : "prospectos"}</p><div className="flex gap-2"><button type="button" disabled={skip === 0 || isFetching} onClick={() => setSkip((value) => Math.max(0, value - LIMIT))} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={16} /> Anterior</button><button type="button" disabled={skip + LIMIT >= total || isFetching} onClick={() => setSkip((value) => value + LIMIT)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">Siguiente <ChevronRight size={16} /></button></div></div> : null}
    </section>
    <LeadDetailModal leadId={leadId} onClose={() => setLeadId(null)} onSaved={() => setShowSuccess(true)} />
    {showSuccess ? <Toast type="success" message="Prospecto actualizado correctamente." onClose={() => setShowSuccess(false)} /> : null}
  </div>;
}
