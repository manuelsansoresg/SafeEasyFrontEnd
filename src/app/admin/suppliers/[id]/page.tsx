"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import SupplierForm from "@/components/admin/SupplierForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

import { CompanyWorkspace, normalizeCompanyTab, type CompanySupplier } from "@/components/admin/company/CompanyWorkspace";
import { isAdminRole } from "@/lib/currentSupplier";
import { loadManagedSupplier } from "@/lib/managedSupplier";

function EditSupplierContent() {
  const params = useParams();
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token, user } = useAuthStore();
  const isGeneralAdmin = isAdminRole(user?.role);

  const [supplier, setSupplier] = useState<CompanySupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = normalizeCompanyTab(searchParams.get("tab"));
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const changeDemo = async () => {
    if (!supplier || !token || !isGeneralAdmin || savingDemo) return;
    const nextValue = supplier.is_demo !== true;
    if (nextValue && !supplier.slug) {
      setDemoMessage({ type: "error", text: "Agrega una URL (slug) al proveedor antes de activar la demostración." });
      return;
    }
    const action = nextValue ? "activar" : "desactivar";
    if (!window.confirm(`¿Quieres ${action} el modo de demostración para ${supplier.name}?`)) return;
    setSavingDemo(true);
    setDemoMessage(null);
    try {
      const response = await fetchWithAuth(`/api/admin/suppliers/${supplier.id}/demo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ is_demo: nextValue }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? (payload as { detail: unknown }).detail : null;
        throw new Error(response.status === 409
          ? "Hay pedidos, pagos o reservaciones pendientes. Resuélvelos antes de activar la demostración."
          : typeof detail === "string" ? detail : `No se pudo actualizar el proveedor (${response.status}).`);
      }
      const updated: unknown = await response.json();
      if (!updated || typeof updated !== "object" || !("is_demo" in updated) ||
          typeof (updated as { is_demo: unknown }).is_demo !== "boolean") {
        throw new Error("El servidor devolvió una respuesta incompleta.");
      }
      setSupplier((current) => current ? { ...current, is_demo: (updated as { is_demo: boolean }).is_demo } : current);
      setDemoMessage({ type: "success", text: nextValue ? "Demostración activada." : "Proveedor comercial restaurado." });
    } catch (cause) {
      setDemoMessage({ type: "error", text: cause instanceof Error ? cause.message : "No se pudo actualizar el proveedor." });
    } finally {
      setSavingDemo(false);
    }
  };

  const fetchSupplier = useCallback(async (silent = false) => {
    if (!token || !isGeneralAdmin) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      setSupplier(await loadManagedSupplier(Number(id)) as CompanySupplier);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo cargar el proveedor.");
    } finally {
      setLoading(false);
    }
  }, [id, token, isGeneralAdmin]);

  useEffect(() => { void fetchSupplier(); }, [fetchSupplier]);

  if (!isGeneralAdmin) return <p className="p-6 text-red-700" role="alert">Necesitas una cuenta de administrador para gestionar este proveedor.</p>;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !supplier || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Proveedor no encontrado"}</p>
        <Link href="/admin/suppliers" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return <div className="space-y-5">
    <Link href="/admin/suppliers" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#004e28]"><ArrowLeft size={16} />Volver a proveedores</Link>
    <CompanyWorkspace key={supplier.id} supplier={supplier} token={token} isDirectory={supplier.is_directory === true} enabledModules={[]} activeTab={activeTab} onNavigate={tab => router.replace(`/admin/suppliers/${supplier.id}?tab=${tab}`, { scroll: false })} onSupplierUpdated={() => fetchSupplier(true)} administration={<div className="space-y-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Configuración de demostración">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-[#004e28]">Proveedor de demostración</h2>
              <p className="mt-1 text-sm text-gray-600">Las demostraciones se muestran en una URL separada y no aceptan operaciones reales.</p>
              {supplier.is_demo && supplier.slug && <Link className="mt-2 inline-block text-sm font-semibold text-[#168e00] underline" href={`/demos/${encodeURIComponent(supplier.slug)}`} target="_blank">Ver demostración</Link>}
            </div>
            <button type="button" role="switch" aria-checked={supplier.is_demo === true} aria-label="Proveedor de demostración" disabled={savingDemo} onClick={changeDemo}
              className={`relative h-8 w-14 rounded-full transition-colors disabled:opacity-60 ${supplier.is_demo ? "bg-[#168e00]" : "bg-gray-300"}`}>
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${supplier.is_demo ? "left-7" : "left-1"}`} />
            </button>
          </div>
          {savingDemo && <p className="mt-3 text-sm text-gray-600" role="status">Guardando cambio…</p>}
          {demoMessage && <p className={`mt-3 text-sm ${demoMessage.type === "error" ? "text-red-700" : "text-[#168e00]"}`} role="status">{demoMessage.text}</p>}
        </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"><h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Administración del proveedor</h2><p className="mt-2 mb-6 text-sm text-gray-500">Conserva las opciones de cuenta, estado y configuración del panel administrativo.</p><SupplierForm initialData={supplier} isEditMode onSaved={() => fetchSupplier(true)} /></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-600"><h2 className="font-semibold text-[#004e28]">Módulos y funciones de la cuenta</h2><p className="mt-2">Las funciones de catálogo de servicios, menú, agenda, generación de QR y tarifas de envío opera sobre la cuenta conectada. Para gestionarlos aquí, el backend debe permitir seleccionar este proveedor. No se utilizará la cuenta del administrador como sustituto.</p><Link href="/admin/modules" className="mt-3 inline-flex min-h-11 items-center font-semibold text-[#004e28] underline">Administrar catálogo y asignación de módulos</Link></section>
    </div>} />
  </div>;
}

export default function EditSupplierPage() {
  const { id } = useParams();
  return <Suspense fallback={<p className="p-6 text-sm text-gray-500">Cargando proveedor…</p>}><EditSupplierContent key={String(id)} /></Suspense>;
}
