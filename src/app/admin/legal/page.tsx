"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle, FileText, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { legalService, LegalDocument, LegalSectionType } from "@/services/legalService";
import { cn } from "@/lib/utils";
import { sanitizeLegalHtml } from "@/lib/sanitizeLegalHtml";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const sectionOptions: Array<{
  type: LegalSectionType;
  label: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
}> = [
  {
    type: "terms_and_conditions",
    label: "Términos",
    title: "Términos y condiciones",
    subtitle: "Administra el documento vigente que se muestra en el sitio.",
    emptyTitle: "Crear términos y condiciones",
  },
  {
    type: "privacy_policy",
    label: "Privacidad",
    title: "Política de privacidad",
    subtitle: "Administra el documento vigente sobre el manejo de datos.",
    emptyTitle: "Crear política de privacidad",
  },
];

const emptyForm = {
  title: "",
  subtitle: "",
  content: "",
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminLegalPage() {
  const [activeType, setActiveType] = useState<LegalSectionType>("terms_and_conditions");
  const [documents, setDocuments] = useState<Record<LegalSectionType, LegalDocument | null>>({
    terms_and_conditions: null,
    privacy_policy: null,
  });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  const currentOption = sectionOptions.find((option) => option.type === activeType) ?? sectionOptions[0];
  const currentDocument = documents[activeType];
  const isEditing = Boolean(currentDocument);

  const sanitizedPreview = useMemo(() => sanitizeLegalHtml(form.content), [form.content]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const [terms, privacy] = await Promise.all([
        legalService.getCurrent("terms_and_conditions"),
        legalService.getCurrent("privacy_policy"),
      ]);
      setDocuments({
        terms_and_conditions: terms,
        privacy_policy: privacy,
      });
    } catch {
      setToast({ type: "error", message: "No se pudieron cargar los documentos legales." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (currentDocument) {
      setForm({
        title: currentDocument.title,
        subtitle: currentDocument.subtitle,
        content: currentDocument.content,
      });
      return;
    }
    setForm(emptyForm);
  }, [currentDocument, activeType]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitizedContent = sanitizeLegalHtml(form.content.trim());
    const readableContent = sanitizedContent.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

    if (!form.title.trim() || !form.subtitle.trim() || !readableContent) {
      setToast({ type: "error", message: "Completa título, subtítulo y contenido." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        content: sanitizedContent,
        is_active: true,
      };
      const saved = currentDocument
        ? await legalService.update(currentDocument.id, payload)
        : await legalService.create(activeType, payload);

      if (!saved) {
        setToast({ type: "error", message: "No se pudo guardar el documento." });
        return;
      }

      setDocuments((prev) => ({ ...prev, [activeType]: saved }));
      setToast({
        type: "success",
        message: currentDocument ? "Documento actualizado correctamente." : "Documento creado correctamente.",
      });
    } catch {
      setToast({ type: "error", message: "Ocurrió un error al guardar el documento." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentDocument) return;
    if (!confirm(`¿Eliminar ${currentOption.title.toLowerCase()}? Al eliminarlo podrás crear uno nuevo.`)) return;

    setDeleting(true);
    try {
      const ok = await legalService.delete(currentDocument.id);
      if (!ok) {
        setToast({ type: "error", message: "No se pudo eliminar el documento." });
        return;
      }

      setDocuments((prev) => ({ ...prev, [activeType]: null }));
      setForm(emptyForm);
      setToast({ type: "success", message: "Documento eliminado. Ya puedes crear uno nuevo." });
    } catch {
      setToast({ type: "error", message: "Ocurrió un error al eliminar el documento." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <PageHero
        title="Legales"
        subtitle="Gestiona las secciones dinámicas legales del sitio."
        eyebrow="Contenido del sitio"
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          {sectionOptions.map((option) => {
            const document = documents[option.type];
            const selected = activeType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setActiveType(option.type)}
                className={cn(
                  "flex min-h-24 items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-primary bg-primary text-white shadow-md shadow-primary/15"
                    : "border-transparent text-gray-700 hover:bg-[#f2f3f4]"
                )}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      selected ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
                    )}
                  >
                    {option.type === "privacy_policy" ? <ShieldCheck size={20} /> : <FileText size={20} />}
                  </span>
                  <span>
                    <span className="block font-semibold">{option.title}</span>
                    <span className={cn("mt-1 block text-sm", selected ? "text-white/75" : "text-gray-500")}>
                      {document ? `Versión ${document.version}` : "Sin alta activa"}
                    </span>
                  </span>
                </span>
                {document ? <CheckCircle size={20} className={selected ? "text-white" : "text-[#168e00]"} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            Cargando documentos legales...
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  {isEditing ? <Pencil size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
                  {isEditing ? `Editar ${currentOption.title.toLowerCase()}` : currentOption.emptyTitle}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{currentOption.subtitle}</p>
              </div>

              {currentDocument ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  Eliminar
                </button>
              ) : null}
            </div>

            {currentDocument ? (
              <div className="grid gap-3 rounded-lg bg-[#f2f3f4] p-4 text-sm text-gray-600 md:grid-cols-3">
                <div>
                  <p className="font-semibold text-gray-900">Estado</p>
                  <p>Activo</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Versión</p>
                  <p>{currentDocument.version}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Actualizado</p>
                  <p>{formatDate(currentDocument.updated_at)}</p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Título *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={currentOption.title}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Subtítulo *</span>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                  placeholder="Última actualización: Mayo 2026"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Contenido *</span>
              <div className="bg-white">
                <ReactQuill
                  theme="snow"
                  value={form.content}
                  onChange={(content) => setForm((prev) => ({ ...prev, content }))}
                  style={{ height: "360px", marginBottom: "50px" }}
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike", "blockquote"],
                      [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
                      [{ align: [] }],
                      ["link", "image"],
                      ["clean"],
                    ],
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                {isEditing ? "Guardar cambios" : "Crear documento"}
              </button>
            </div>
          </form>

          <aside className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
              <p className="mt-1 text-sm text-gray-500">Así se leerá el contenido HTML guardado.</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-[#f2f3f4] p-4">
              <p className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-primary">
                {form.title || currentOption.title}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#168e00]">
                {form.subtitle || "Subtítulo del documento"}
              </p>
            </div>

            <div className="prose prose-sm max-w-none rounded-xl border border-gray-100 p-4 text-gray-700 prose-headings:text-primary prose-a:text-[#168e00]">
              {form.content.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizedPreview }} />
              ) : (
                <p className="text-gray-400">Escribe el contenido para ver la vista previa.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
