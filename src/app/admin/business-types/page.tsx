"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Edit2, Loader2, Plus, Search } from "lucide-react";
import { BusinessTypeForm } from "@/components/admin/BusinessTypeForm";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { businessTypeService } from "@/services/businessTypeService";
import { useAuthStore } from "@/store/useAuthStore";
import type { BusinessTypeAdminList } from "@/types/businessType";

const limit = 20;
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const actionClass = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed";

export default function AdminBusinessTypesPage() {
  const { user, token } = useAuthStore();
  const mounted = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);

  if (!mounted) return <p role="status" className="py-8 text-center text-gray-500">Cargando...</p>;
  if (!token) return <p className="py-8 text-center">Debes <Link href="/login" className="text-primary underline">iniciar sesión</Link> para acceder al panel.</p>;
  if (user?.role !== "admin" && user?.role !== "superuser") return <p role="alert" className="py-8 text-center">No tienes permiso para administrar tipos de negocio.</p>;

  return <BusinessTypesContent />;
}

function BusinessTypesContent() {
  const [items, setItems] = useState<BusinessTypeAdminList[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [skip, setSkip] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ id: number | null } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await businessTypeService.list({ search, is_active: status === "all" ? undefined : status === "active", skip, limit }, controller.signal);
        if (controller.signal.aborted) return;
        if (result.length === 0 && skip > 0) {
          setSkip((current) => Math.max(0, current - limit));
        } else {
          setItems(result);
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No se pudo cargar el listado. Inténtalo de nuevo.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search, status, skip, revision]);

  useEffect(() => {
    if (!toast || toast.type === "error") return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function refresh(message: string) {
    setToast({ type: "success", message });
    setLoading(true);
    setRevision((value) => value + 1);
  }

  async function toggle(item: BusinessTypeAdminList) {
    if (busyId !== null) return;
    if (item.is_active && !window.confirm("¿Desactivar este tipo de negocio?\n\nLos proveedores existentes no serán eliminados.")) return;
    setBusyId(item.id);
    try {
      if (item.is_active) await businessTypeService.deactivate(item.id);
      else await businessTypeService.update(item.id, { is_active: true });
      refresh(item.is_active ? "Tipo de negocio desactivado." : "Tipo de negocio activado.");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "No se pudo cambiar el estado. Inténtalo de nuevo." });
    } finally {
      setBusyId(null);
    }
  }

  function actions(item: BusinessTypeAdminList) {
    return <div className="flex flex-wrap justify-end gap-1">
      <button type="button" disabled={busyId !== null} onClick={() => setEditor({ id: item.id })} className={actionClass} aria-label={`Editar ${item.name}`}><Edit2 size={16} />Editar</button>
      <button type="button" disabled={busyId !== null} onClick={() => void toggle(item)} className={actionClass} aria-label={`${item.is_active ? "Desactivar" : "Activar"} ${item.name}`}>
        {busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : null}{item.is_active ? "Desactivar" : "Activar"}
      </button>
    </div>;
  }

  function badge(active: boolean) {
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${active ? "border-green-100 bg-green-50 text-green-700" : "border-gray-100 bg-gray-50 text-gray-600"}`}>{active ? "Activo" : "Inactivo"}</span>;
  }

  return <div className="space-y-6">
    {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
    <PageHero title="Tipos de negocio" subtitle="Administra los tipos de negocio y las categorías que pueden utilizar." eyebrow="Contenido" actions={
      <button type="button" disabled={busyId !== null} onClick={() => setEditor({ id: null })} className="flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-white shadow-sm transition hover:bg-[#004e28] disabled:opacity-50"><Plus size={20} />Nuevo tipo</button>
    } />
    <section aria-label="Listado de tipos de negocio" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setSkip(0); setLoading(true); }} aria-label="Buscar tipos de negocio" placeholder="Buscar tipos de negocio..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setSkip(0); setLoading(true); }} aria-label="Filtrar por estado" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20">
          <option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
        </select>
      </div>
      {loading ? <p role="status" className="flex items-center justify-center gap-2 p-10 text-gray-500"><Loader2 size={20} className="animate-spin" />Cargando tipos de negocio...</p>
        : error ? <div role="alert" className="space-y-3 p-6 text-center"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setLoading(true); setRevision((value) => value + 1); }} className={actionClass}>Reintentar</button></div>
        : items.length === 0 ? <div className="flex flex-col items-center gap-3 p-10 text-center text-gray-500"><BriefcaseBusiness size={32} className="text-primary" /><p>No se encontraron tipos de negocio.</p></div>
        : <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500"><tr>{["Nombre", "Estado", "Categorías", "Proveedores", "Acciones"].map((label) => <th scope="col" key={label} className={`px-5 py-4 ${label === "Acciones" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="max-w-xs break-words px-5 py-4 font-medium text-gray-900">{item.name}</td><td className="px-5 py-4">{badge(item.is_active)}</td><td className="px-5 py-4">{item.categories_count} categorías</td><td className="px-5 py-4">{item.suppliers_count} proveedores</td><td className="px-5 py-4">{actions(item)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">{items.map((item) => <article key={item.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold text-gray-900">{item.name}</h2><div className="shrink-0">{badge(item.is_active)}</div></div>
            <p className="text-sm text-gray-600">{item.categories_count} categorías · {item.suppliers_count} proveedores</p>{actions(item)}
          </article>)}</div>
        </>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-4 text-sm text-gray-500">
        <span>Página {Math.floor(skip / limit) + 1}</span>
        <div className="flex gap-2"><button type="button" disabled={loading || skip === 0} onClick={() => { setSkip((value) => Math.max(0, value - limit)); setLoading(true); }} className={actionClass}>Anterior</button><button type="button" disabled={loading || !!error || items.length < limit} onClick={() => { setSkip((value) => value + limit); setLoading(true); }} className={actionClass}>Siguiente</button></div>
      </div>
    </section>
    {editor ? <BusinessTypeForm key={editor.id ?? "new"} id={editor.id} onClose={() => setEditor(null)} onSaved={refresh} /> : null}
  </div>;
}
