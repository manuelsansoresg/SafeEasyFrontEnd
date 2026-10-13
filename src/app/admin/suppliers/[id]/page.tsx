"use client";

import { useState, useEffect } from "react";
import SupplierForm from "@/components/admin/SupplierForm";
import StepCarousel from "@/components/sell/wizard/StepCarousel";
import StepCertificates from "@/components/sell/wizard/StepCertificates";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  slug?: string;
  rfc?: string;
  phone?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  is_demo?: boolean;
  user_id: number;
}

export default function EditSupplierPage() {
  const params = useParams();
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token, user } = useAuthStore();
  const isGeneralAdmin = String(user?.role || "").toLowerCase() === "admin";

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "carousel" | "certificates">("info");
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

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!id) {
        setError("Proveedor no encontrado");
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const encodedId = encodeURIComponent(String(id));
        if (isGeneralAdmin) {
          const adminList = await fetchWithAuth(`/api/suppliers/?id=${encodedId}&skip=0&limit=1`);
          if (adminList.ok) {
            const payload: unknown = await adminList.json();
            const items = Array.isArray(payload) ? payload : [];
            const found = items.find((item: Supplier) => String(item.id) === String(id));
            if (found) {
              setSupplier(found);
              return;
            }
          }
        }
        const detailUrls = [
          `/api/suppliers/${encodedId}`,
          `/api/suppliers/${encodedId}/`,
          `/api/v1/suppliers/${encodedId}`,
          `/api/v1/suppliers/${encodedId}/`,
        ];

        let detailError = "";
        for (const url of detailUrls) {
          try {
            const response = await fetchWithAuth(url, { headers: { Accept: "application/json" } });

            if (response.ok) {
              const data = await response.json();
              setSupplier(data);
              return;
            }

            const text = await response.text().catch(() => "");
            detailError = `Error ${response.status}${text ? `: ${text}` : ""}`;
          } catch (err: unknown) {
            detailError =
              err instanceof Error ? `Error de conexión: ${err.message}` : "Error de conexión desconocido";
            console.error(`Fetch error loading supplier ${id} from ${url}:`, err);
          }
        }

        const listUrls = [
          `/api/suppliers/?skip=0&limit=1000`,
          `/api/suppliers?skip=0&limit=1000`,
        ];

        for (const url of listUrls) {
          const listResponse = await fetchWithAuth(url, { headers: { Accept: "application/json" } }).catch(
            (err: unknown) => {
              console.error(`Fetch error loading supplier list from ${url}:`, err);
              return null;
            },
          );

          if (!listResponse) continue;
          if (listResponse.ok) {
            const listData = await listResponse.json();
            const list = Array.isArray(listData)
              ? listData
              : listData && typeof listData === "object" && Array.isArray((listData as Record<string, unknown>).items)
                ? ((listData as Record<string, unknown>).items as Supplier[])
                : [];
            const found = list.find((s: Supplier) => String(s.id) === String(id));

            if (found) {
              setSupplier(found);
              return;
            }
          }
        }

        setError(detailError || "No se pudo cargar la información del proveedor");
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(`Error de conexión: ${err.message}`);
          console.error("Fetch error:", err);
        } else {
          setError("Error de conexión desconocido");
          console.error("Fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [id, token, isGeneralAdmin]);

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

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Proveedor"
        subtitle={`Modifica los datos del proveedor ${supplier.name}.`}
        eyebrow="Usuarios"
        actions={
          <Link href="/admin/suppliers" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      {isGeneralAdmin && (
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
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex space-x-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("info")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "info"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Información General
          </button>
          <button
            onClick={() => setActiveTab("carousel")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "carousel"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Encabezado
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "certificates"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Certificados
          </button>
        </div>

        {activeTab === "info" && (
          <SupplierForm initialData={supplier} isEditMode={true} />
        )}

        {activeTab === "carousel" && (
          <StepCarousel
            supplierId={supplier.id}
            slug={supplier.slug || supplier.short_name || undefined}
            token={token}
            onNext={() => setActiveTab("certificates")}
          />
        )}

        {activeTab === "certificates" && (
          <StepCertificates 
            supplierId={supplier.id} 
            slug={supplier.slug || supplier.short_name || undefined}
            token={token} 
            onNext={() => {}} 
          />
        )}
      </div>
    </div>
  );
}
