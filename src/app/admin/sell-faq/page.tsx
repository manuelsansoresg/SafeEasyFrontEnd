"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  CircleHelp,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { sellFaqService, type SellFaq, type SellFaqPayload } from "@/services/sellFaqService";

const emptyForm: SellFaqPayload = {
  question: "",
  answer: "",
  position: 1,
  is_active: true,
};

const normalizeForm = (form: SellFaqPayload): SellFaqPayload => ({
  question: form.question.trim(),
  answer: form.answer.trim(),
  position: Math.max(0, Number(form.position) || 0),
  is_active: form.is_active,
});

export default function AdminSellFaqPage() {
  const [items, setItems] = useState<SellFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<SellFaq | null>(null);
  const [form, setForm] = useState<SellFaqPayload>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.position - b.position || a.id - b.id),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((item) => (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q)
    ));
  }, [searchTerm, sortedItems]);

  const nextPosition = useMemo(() => {
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => Number(item.position) || 0)) + 1;
  }, [items]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sellFaqService.list();
      setItems(data);
      if (!editing) {
        setForm((current) => ({ ...current, position: data.length ? Math.max(...data.map((item) => item.position)) + 1 : 1 }));
      }
    } catch {
      setToast({ type: "error", message: "No se pudieron cargar las preguntas." });
    } finally {
      setLoading(false);
    }
  }, [editing]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, position: nextPosition });
  };

  const startEdit = (item: SellFaq) => {
    setEditing(item);
    setForm({
      question: item.question,
      answer: item.answer,
      position: item.position,
      is_active: item.is_active,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = normalizeForm(form);

    if (!payload.question || !payload.answer) {
      setToast({ type: "error", message: "Completa la pregunta y la respuesta." });
      return;
    }

    setSaving(true);
    try {
      const saved = editing
        ? await sellFaqService.update(editing.id, payload)
        : await sellFaqService.create(payload);

      if (!saved) {
        setToast({ type: "error", message: "No se pudo guardar la pregunta." });
        return;
      }

      setToast({
        type: "success",
        message: editing ? "Pregunta actualizada correctamente." : "Pregunta creada correctamente.",
      });
      resetForm();
      await loadItems();
    } catch {
      setToast({ type: "error", message: "Ocurrió un error al guardar la pregunta." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: SellFaq) => {
    if (!confirm(`¿Eliminar la pregunta "${item.question}"?`)) return;
    setDeletingId(item.id);
    try {
      const ok = await sellFaqService.delete(item.id);
      if (!ok) {
        setToast({ type: "error", message: "No se pudo eliminar la pregunta." });
        return;
      }
      setToast({ type: "success", message: "Pregunta eliminada correctamente." });
      if (editing?.id === item.id) resetForm();
      await loadItems();
    } catch {
      setToast({ type: "error", message: "Ocurrió un error al eliminar la pregunta." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (item: SellFaq) => {
    const updated = await sellFaqService.update(item.id, {
      question: item.question,
      answer: item.answer,
      position: item.position,
      is_active: !item.is_active,
    });
    if (!updated) {
      setToast({ type: "error", message: "No se pudo cambiar el estado." });
      return;
    }
    setItems((current) => current.map((faq) => (faq.id === item.id ? updated : faq)));
  };

  const swapPosition = async (item: SellFaq, direction: "up" | "down") => {
    const index = sortedItems.findIndex((faq) => faq.id === item.id);
    const other = direction === "up" ? sortedItems[index - 1] : sortedItems[index + 1];
    if (!other) return;

    const firstPayload: SellFaqPayload = {
      question: item.question,
      answer: item.answer,
      position: other.position,
      is_active: item.is_active,
    };
    const secondPayload: SellFaqPayload = {
      question: other.question,
      answer: other.answer,
      position: item.position,
      is_active: other.is_active,
    };

    const [first, second] = await Promise.all([
      sellFaqService.update(item.id, firstPayload),
      sellFaqService.update(other.id, secondPayload),
    ]);

    if (!first || !second) {
      setToast({ type: "error", message: "No se pudo actualizar el orden." });
      return;
    }

    setItems((current) => current.map((faq) => {
      if (faq.id === first.id) return first;
      if (faq.id === second.id) return second;
      return faq;
    }));
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <PageHero
        title="Preguntas"
        subtitle="Administra las preguntas frecuentes de la sección de venta."
        eyebrow="Contenido"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Listado de preguntas</h2>
              <p className="text-sm text-gray-500">{items.length} preguntas registradas</p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar pregunta..."
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f2f3f4]/70">
                  <th className="w-24 px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Orden</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Pregunta</th>
                  <th className="w-32 px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Estado</th>
                  <th className="w-40 px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={18} />
                        Cargando preguntas...
                      </span>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-gray-500">
                        <CircleHelp className="text-primary" size={34} />
                        <p className="font-medium text-gray-700">No hay preguntas para mostrar</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr key={item.id} className="transition hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-gray-300" />
                          <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-700">
                            {item.position}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => void swapPosition(item, "up")}
                              disabled={index === 0}
                              className="rounded text-gray-400 hover:text-primary disabled:opacity-30"
                              aria-label="Subir pregunta"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void swapPosition(item, "down")}
                              disabled={index === filteredItems.length - 1}
                              className="rounded text-gray-400 hover:text-primary disabled:opacity-30"
                              aria-label="Bajar pregunta"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{item.question}</p>
                        <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-gray-500">{item.answer}</p>
                      </td>
                      <td className="px-5 py-4">
                        {item.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            <CheckCircle size={12} />
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                            <XCircle size={12} />
                            Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(item)}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-primary/5 hover:text-primary"
                            title={item.is_active ? "Desactivar" : "Activar"}
                          >
                            {item.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-primary/5 hover:text-primary"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deletingId === item.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 md:hidden">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  Cargando preguntas...
                </span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-10">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center text-gray-500">
                  <CircleHelp className="text-primary" size={34} />
                  <p className="font-medium text-gray-700">No hay preguntas para mostrar</p>
                </div>
              </div>
            ) : (
              filteredItems.map((item, index) => (
                <article key={item.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex shrink-0 items-center gap-1">
                        <GripVertical size={15} className="text-gray-300" />
                        <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-700">
                          {item.position}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-gray-900">{item.question}</p>
                        <p className="mt-1 line-clamp-3 break-words text-sm leading-6 text-gray-500">{item.answer}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => void swapPosition(item, "up")}
                        disabled={index === 0}
                        className="rounded p-1 text-gray-400 hover:text-primary disabled:opacity-30"
                        aria-label="Subir pregunta"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void swapPosition(item, "down")}
                        disabled={index === filteredItems.length - 1}
                        className="rounded p-1 text-gray-400 hover:text-primary disabled:opacity-30"
                        aria-label="Bajar pregunta"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        <CheckCircle size={12} />
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <XCircle size={12} />
                        Inactiva
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(item)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-primary/5 hover:text-primary"
                        title={item.is_active ? "Desactivar" : "Activar"}
                      >
                        {item.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-primary/5 hover:text-primary"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === item.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-28 xl:self-start">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#168e00]">
                {editing ? "Editar" : "Nueva"}
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? "Actualizar pregunta" : "Crear pregunta"}
              </h2>
            </div>
            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cancelar edición"
              >
                <X size={19} />
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Pregunta</label>
              <input
                type="text"
                value={form.question}
                onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="¿Cómo funciona la verificación?"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Respuesta</label>
              <textarea
                value={form.answer}
                onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                className="min-h-36 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="Escribe la respuesta que verá el usuario..."
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Posición</label>
                <input
                  type="number"
                  min={0}
                  value={form.position}
                  onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))}
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 sm:mt-7">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                Activa
              </label>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : editing ? <Save size={17} /> : <Plus size={17} />}
                {editing ? "Guardar" : "Crear"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 sm:w-auto"
              >
                <RotateCcw size={17} />
                Limpiar
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
