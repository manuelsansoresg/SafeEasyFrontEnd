"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { MenuForm } from "@/components/admin/menu/MenuForm";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { useMenuModuleAccess } from "@/hooks/useMenuModuleAccess";
import { menuService } from "@/services/menuService";
import type { Menu, MenuCreatePayload } from "@/types/menu";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

function formatMoney(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function scheduleText(menu: Menu) {
  const parts: string[] = [];
  if (menu.date_start || menu.date_end) {
    parts.push(
      [menu.date_start, menu.date_end].filter(Boolean).join(" → "),
    );
  }
  if (menu.time_start && menu.time_end) {
    parts.push(`${menu.time_start.slice(0, 5)} - ${menu.time_end.slice(0, 5)}`);
  }
  return parts.join(" · ");
}

export default function AdminMenuPage() {
  const { loading: accessLoading, hasAccess } = useMenuModuleAccess(true);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const loadMenus = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const data = await menuService.list(controller.signal);
      setMenus([...data].sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar tus menús.");
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [hasAccess]);

  useEffect(() => {
    if (accessLoading) return;
    void loadMenus();
  }, [accessLoading, loadMenus]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const totals = useMemo(() => {
    const active = menus.filter((menu) => menu.is_active).length;
    const sections = menus.reduce((sum, menu) => sum + menu.sections.length, 0);
    return { active, sections };
  }, [menus]);

  const openCreate = () => {
    setEditingMenu(null);
    setFormOpen(true);
  };

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setFormOpen(true);
  };

  const saveMenu = async (payload: MenuCreatePayload) => {
    setSaving(true);
    try {
      if (editingMenu) {
        const updated = await menuService.update(editingMenu.id, payload);
        setMenus((current) => current.map((menu) => (menu.id === updated.id ? updated : menu)));
        setToast({ type: "success", message: "Menú actualizado correctamente." });
      } else {
        const created = await menuService.create(payload);
        setMenus((current) => [...current, created].sort((a, b) => a.display_order - b.display_order || a.id - b.id));
        setToast({ type: "success", message: "Menú creado correctamente." });
      }
      setFormOpen(false);
      setEditingMenu(null);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo guardar el menú." });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (menu: Menu) => {
    setBusyId(menu.id);
    try {
      const updated = await menuService.update(menu.id, { is_active: !menu.is_active });
      setMenus((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setToast({ type: "success", message: updated.is_active ? "Menú activado." : "Menú desactivado." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo cambiar el estado." });
    } finally {
      setBusyId(null);
    }
  };

  const removeMenu = async (menu: Menu) => {
    const accepted = window.confirm(`¿Eliminar definitivamente "${menu.name}"? También se eliminarán sus secciones y elementos.`);
    if (!accepted) return;
    setBusyId(menu.id);
    try {
      await menuService.remove(menu.id);
      setMenus((current) => current.filter((item) => item.id !== menu.id));
      setToast({ type: "success", message: "Menú eliminado." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo eliminar el menú." });
    } finally {
      setBusyId(null);
    }
  };

  if (accessLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={32} />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero title="Menú" subtitle="Administra los menús de tu negocio." eyebrow="Módulo" />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold">El módulo Menú no está activo en tu cuenta</h2>
              <p className="mt-1 text-sm">Activa o solicita el módulo desde tu sección de módulos disponibles antes de administrar contenido.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHero
        eyebrow="Módulo"
        title="Menú"
        subtitle="Crea varios menús, organiza secciones y administra tus platillos o servicios."
        actions={
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#117500]">
            <Plus size={18} /> Nuevo menú
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Menús</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{menus.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Activos</p>
          <p className="mt-1 text-3xl font-bold text-[#168e00]">{totals.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Secciones</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totals.sections}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-gray-100 bg-white">
          <Loader2 className="animate-spin text-[#168e00]" size={30} />
        </div>
      ) : menus.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]"><UtensilsCrossed size={28} /></div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Todavía no tienes menús</h2>
          <p className="mx-auto mt-2 max-w-lg text-gray-500">Puedes crear uno muy sencillo y agregar más información cuando la necesites.</p>
          <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white"><Plus size={18} /> Crear primer menú</button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => {
            const schedule = scheduleText(menu);
            const price = formatMoney(menu.price);
            const itemCount = menu.sections.reduce((sum, section) => sum + section.items.length, 0);
            return (
              <article key={menu.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#004e28] to-[#168e00] text-white">
                  {menu.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={menu.image_thumbnail_url || menu.image_url} alt={menu.name} className="h-full w-full object-cover" />
                  ) : (
                    <UtensilsCrossed size={42} strokeWidth={1.7} />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-bold text-gray-900">{menu.name}</h2>
                        <span className={menu.is_active ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700" : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500"}>{menu.is_active ? "Activo" : "Inactivo"}</span>
                      </div>
                      {menu.description ? <p className="mt-2 line-clamp-2 text-sm text-gray-500">{menu.description}</p> : null}
                    </div>
                    <MoreVertical size={19} className="shrink-0 text-gray-300" />
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-500">
                    <p><strong className="text-gray-800">{menu.sections.length}</strong> secciones · <strong className="text-gray-800">{itemCount}</strong> elementos</p>
                    {price ? <p className="font-semibold text-[#004e28]">{price}</p> : null}
                    {schedule ? <p className="flex items-center gap-2"><CalendarDays size={15} /> {schedule}</p> : null}
                    {menu.time_start && menu.time_end ? <span className="sr-only"><Clock3 />Horario configurado</span> : null}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link href={`/admin/menu/${menu.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#117500]">
                      <UtensilsCrossed size={16} /> Administrar
                    </Link>
                    <button type="button" onClick={() => openEdit(menu)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                      <Pencil size={16} /> Editar
                    </button>
                    <button type="button" disabled={busyId === menu.id} onClick={() => void toggleActive(menu)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                      {busyId === menu.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                      {menu.is_active ? "Desactivar" : "Activar"}
                    </button>
                    <button type="button" disabled={busyId === menu.id} onClick={() => void removeMenu(menu)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MenuForm open={formOpen} menu={editingMenu} saving={saving} onClose={() => { if (!saving) { setFormOpen(false); setEditingMenu(null); } }} onSubmit={saveMenu} />
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
