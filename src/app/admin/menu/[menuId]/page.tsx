"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { MenuForm } from "@/components/admin/menu/MenuForm";
import { MenuItemForm } from "@/components/admin/menu/MenuItemForm";
import { MenuSectionForm } from "@/components/admin/menu/MenuSectionForm";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { menuService } from "@/services/menuService";
import type {
  Menu,
  MenuCreatePayload,
  MenuItem,
  MenuItemPayload,
  MenuSection,
  MenuSectionPayload,
} from "@/types/menu";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSize = 8 * 1024 * 1024;

function money(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function validateImage(file: File) {
  if (!allowedTypes.has(file.type)) return "La imagen debe ser JPG, PNG o WebP.";
  if (file.size > maxSize) return "La imagen no puede superar 8 MB.";
  return null;
}

export default function AdminMenuDetailPage() {
  const params = useParams<{ menuId: string }>();
  const menuId = Number(params.menuId);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  const loadMenu = useCallback(async () => {
    if (!Number.isFinite(menuId) || menuId <= 0) {
      setError("El identificador del menú no es válido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMenu(await menuService.detail(menuId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el menú.");
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const totalItems = useMemo(
    () => menu?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0,
    [menu],
  );

  const saveMenu = async (payload: MenuCreatePayload) => {
    if (!menu) return;
    setSaving(true);
    try {
      const updated = await menuService.update(menu.id, payload);
      setMenu(updated);
      setMenuFormOpen(false);
      setToast({ type: "success", message: "Datos del menú actualizados." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo actualizar el menú." });
    } finally {
      setSaving(false);
    }
  };

  const uploadMenuImage = async (file?: File) => {
    if (!file || !menu) return;
    const validation = validateImage(file);
    if (validation) {
      setToast({ type: "error", message: validation });
      return;
    }
    setBusy("menu-image");
    try {
      setMenu(await menuService.uploadImage(menu.id, file));
      setToast({ type: "success", message: "Portada actualizada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo subir la portada." });
    } finally {
      setBusy(null);
    }
  };

  const deleteMenuImage = async () => {
    if (!menu) return;
    setBusy("menu-image");
    try {
      setMenu(await menuService.deleteImage(menu.id));
      setToast({ type: "success", message: "Portada eliminada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo eliminar la portada." });
    } finally {
      setBusy(null);
    }
  };

  const openCreateSection = () => {
    setEditingSection(null);
    setSectionFormOpen(true);
  };

  const openEditSection = (section: MenuSection) => {
    setEditingSection(section);
    setSectionFormOpen(true);
  };

  const saveSection = async (payload: MenuSectionPayload) => {
    if (!menu) return;
    setSaving(true);
    try {
      if (editingSection) {
        await menuService.updateSection(menu.id, editingSection.id, payload);
        setToast({ type: "success", message: "Sección actualizada." });
      } else {
        await menuService.createSection(menu.id, payload);
        setToast({ type: "success", message: "Sección creada." });
      }
      setSectionFormOpen(false);
      setEditingSection(null);
      await loadMenu();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo guardar la sección." });
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = async (section: MenuSection) => {
    if (!menu) return;
    setBusy(`section-${section.id}`);
    try {
      await menuService.updateSection(menu.id, section.id, { is_active: !section.is_active });
      await loadMenu();
      setToast({ type: "success", message: section.is_active ? "Sección desactivada." : "Sección activada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo cambiar el estado." });
    } finally {
      setBusy(null);
    }
  };

  const removeSection = async (section: MenuSection) => {
    if (!menu) return;
    if (!window.confirm(`¿Eliminar la sección "${section.name}" y todos sus elementos?`)) return;
    setBusy(`section-${section.id}`);
    try {
      await menuService.removeSection(menu.id, section.id);
      await loadMenu();
      setToast({ type: "success", message: "Sección eliminada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo eliminar la sección." });
    } finally {
      setBusy(null);
    }
  };

  const openCreateItem = (sectionId: number) => {
    setTargetSectionId(sectionId);
    setEditingItem(null);
    setItemFormOpen(true);
  };

  const openEditItem = (sectionId: number, item: MenuItem) => {
    setTargetSectionId(sectionId);
    setEditingItem(item);
    setItemFormOpen(true);
  };

  const saveItem = async (payload: MenuItemPayload) => {
    if (!menu || !targetSectionId) return;
    setSaving(true);
    try {
      if (editingItem) {
        await menuService.updateItem(menu.id, targetSectionId, editingItem.id, payload);
        setToast({ type: "success", message: "Elemento actualizado." });
      } else {
        await menuService.createItem(menu.id, targetSectionId, payload);
        setToast({ type: "success", message: "Elemento agregado." });
      }
      setItemFormOpen(false);
      setEditingItem(null);
      setTargetSectionId(null);
      await loadMenu();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo guardar el elemento." });
    } finally {
      setSaving(false);
    }
  };

  const toggleItemAvailability = async (sectionId: number, item: MenuItem) => {
    if (!menu) return;
    setBusy(`item-${item.id}`);
    try {
      await menuService.updateItem(menu.id, sectionId, item.id, { is_available: !item.is_available });
      await loadMenu();
      setToast({ type: "success", message: item.is_available ? "Marcado como no disponible." : "Marcado como disponible." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo actualizar el elemento." });
    } finally {
      setBusy(null);
    }
  };

  const removeItem = async (sectionId: number, item: MenuItem) => {
    if (!menu) return;
    if (!window.confirm(`¿Eliminar "${item.name}"?`)) return;
    setBusy(`item-${item.id}`);
    try {
      await menuService.removeItem(menu.id, sectionId, item.id);
      await loadMenu();
      setToast({ type: "success", message: "Elemento eliminado." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo eliminar el elemento." });
    } finally {
      setBusy(null);
    }
  };

  const uploadItemImage = async (sectionId: number, itemId: number, file?: File) => {
    if (!menu || !file) return;
    const validation = validateImage(file);
    if (validation) {
      setToast({ type: "error", message: validation });
      return;
    }
    setBusy(`item-image-${itemId}`);
    try {
      await menuService.uploadItemImage(menu.id, sectionId, itemId, file);
      await loadMenu();
      setToast({ type: "success", message: "Imagen actualizada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo subir la imagen." });
    } finally {
      setBusy(null);
    }
  };

  const deleteItemImage = async (sectionId: number, itemId: number) => {
    if (!menu) return;
    setBusy(`item-image-${itemId}`);
    try {
      await menuService.deleteItemImage(menu.id, sectionId, itemId);
      await loadMenu();
      setToast({ type: "success", message: "Imagen eliminada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo eliminar la imagen." });
    } finally {
      setBusy(null);
    }
  };

  const toggleCollapse = (sectionId: number) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  if (loading && !menu) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={34} className="animate-spin text-[#168e00]" /></div>;
  }

  if (error || !menu) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/admin/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00]"><ArrowLeft size={17} /> Volver a Menús</Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "No se encontró el menú."}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"><ArrowLeft size={17} /> Volver a Menús</Link>

      <PageHero
        eyebrow="Administrar menú"
        title={menu.name}
        subtitle={`${menu.sections.length} secciones · ${totalItems} elementos`}
        actions={
          <button type="button" onClick={() => setMenuFormOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"><Pencil size={17} /> Editar datos</button>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#004e28] to-[#168e00] text-white">
            {menu.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.image_url} alt={menu.name} className="h-full w-full object-cover" />
            ) : (
              <UtensilsCrossed size={52} strokeWidth={1.5} />
            )}
          </div>
          <div className="space-y-3 p-5">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 text-sm font-semibold text-white hover:bg-[#117500]">
              {busy === "menu-image" ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
              {menu.image_url ? "Cambiar portada" : "Subir portada"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy === "menu-image"} onChange={(e) => { void uploadMenuImage(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            </label>
            {menu.image_url ? (
              <button type="button" disabled={busy === "menu-image"} onClick={() => void deleteMenuImage()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"><ImageOff size={17} /> Eliminar portada</button>
            ) : null}
            <p className="text-center text-xs text-gray-400">JPG, PNG o WebP · máximo 8 MB</p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Estado</p><p className="mt-1 font-semibold text-gray-900">{menu.is_active ? "Activo" : "Inactivo"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Precio general</p><p className="mt-1 font-semibold text-gray-900">{money(menu.price) || "Sin precio"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Orden</p><p className="mt-1 font-semibold text-gray-900">{menu.display_order}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Fechas</p><p className="mt-1 text-sm font-medium text-gray-700">{menu.date_start || menu.date_end ? `${menu.date_start || "—"} → ${menu.date_end || "—"}` : "Sin restricción"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Horario</p><p className="mt-1 text-sm font-medium text-gray-700">{menu.time_start && menu.time_end ? `${menu.time_start.slice(0, 5)} - ${menu.time_end.slice(0, 5)}` : "Sin horario"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Días</p><p className="mt-1 text-sm font-medium text-gray-700">{menu.days_of_week?.length ? `${menu.days_of_week.length} días configurados` : "Todos / sin restricción"}</p></div>
          </div>
          {menu.description ? <p className="mt-5 border-t border-gray-100 pt-5 text-sm leading-6 text-gray-600">{menu.description}</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Secciones y elementos</h2>
            <p className="text-sm text-gray-500">Organiza el contenido como lo necesite tu negocio.</p>
          </div>
          <button type="button" onClick={openCreateSection} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white"><Plus size={18} /> Nueva sección</button>
        </div>

        {menu.sections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <h3 className="text-lg font-bold text-gray-900">Aún no hay secciones</h3>
            <p className="mt-1 text-sm text-gray-500">Por ejemplo: Entradas, Platos fuertes, Bebidas o Servicios.</p>
            <button type="button" onClick={openCreateSection} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 font-semibold text-white"><Plus size={17} /> Crear sección</button>
          </div>
        ) : (
          menu.sections.map((section) => {
            const collapsed = collapsedSections.has(section.id);
            const sectionBusy = busy === `section-${section.id}`;
            return (
              <article key={section.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900">{section.name}</h3>
                      <span className={section.is_active ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700" : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500"}>{section.is_active ? "Activa" : "Inactiva"}</span>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">{section.items.length} elementos</span>
                    </div>
                    {section.description ? <p className="mt-1 text-sm text-gray-500">{section.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openCreateItem(section.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#168e00]/10 px-3 py-2 text-sm font-semibold text-[#168e00]"><Plus size={16} /> Elemento</button>
                    <button type="button" onClick={() => openEditSection(section)} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" title="Editar"><Pencil size={17} /></button>
                    <button type="button" disabled={sectionBusy} onClick={() => void toggleSection(section)} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" title={section.is_active ? "Desactivar" : "Activar"}>{sectionBusy ? <Loader2 size={17} className="animate-spin" /> : <Power size={17} />}</button>
                    <button type="button" disabled={sectionBusy} onClick={() => void removeSection(section)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50" title="Eliminar"><Trash2 size={17} /></button>
                    <button type="button" onClick={() => toggleCollapse(section.id)} className="rounded-xl border border-gray-200 p-2 text-gray-500">{collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
                  </div>
                </header>

                {!collapsed ? (
                  <div className="p-5">
                    {section.items.length === 0 ? (
                      <div className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">Esta sección todavía no tiene elementos.</div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {section.items.map((item) => {
                          const itemBusy = busy === `item-${item.id}` || busy === `item-image-${item.id}`;
                          return (
                            <div key={item.id} className="flex gap-4 rounded-2xl border border-gray-100 p-4">
                              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                                {item.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.image_thumbnail_url || item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300"><UtensilsCrossed size={30} /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="truncate font-bold text-gray-900">{item.name}</h4>
                                      {item.label ? <span className="rounded-full bg-[#168e00]/10 px-2 py-0.5 text-[11px] font-bold text-[#168e00]">{item.label}</span> : null}
                                      {!item.is_available ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">No disponible</span> : null}
                                    </div>
                                    {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.description}</p> : null}
                                  </div>
                                  {money(item.price) ? <div className="shrink-0 text-right"><p className="font-bold text-[#004e28]">{money(item.price)}</p>{money(item.old_price) ? <p className="text-xs text-gray-400 line-through">{money(item.old_price)}</p> : null}</div> : null}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => openEditItem(section.id, item)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600"><Pencil size={14} /> Editar</button>
                                  <button type="button" disabled={itemBusy} onClick={() => void toggleItemAvailability(section.id, item)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600"><Power size={14} /> {item.is_available ? "Agotar" : "Disponible"}</button>
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600">
                                    {busy === `item-image-${item.id}` ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                    Foto
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={itemBusy} onChange={(e) => { void uploadItemImage(section.id, item.id, e.target.files?.[0]); e.currentTarget.value = ""; }} />
                                  </label>
                                  {item.image_url ? <button type="button" disabled={itemBusy} onClick={() => void deleteItemImage(section.id, item.id)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500"><ImageOff size={14} /></button> : null}
                                  <button type="button" disabled={itemBusy} onClick={() => void removeItem(section.id, item)} className="rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-500"><Trash2 size={14} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <MenuForm open={menuFormOpen} menu={menu} saving={saving} onClose={() => { if (!saving) setMenuFormOpen(false); }} onSubmit={saveMenu} />
      <MenuSectionForm open={sectionFormOpen} section={editingSection} saving={saving} onClose={() => { if (!saving) { setSectionFormOpen(false); setEditingSection(null); } }} onSubmit={saveSection} />
      <MenuItemForm open={itemFormOpen} item={editingItem} saving={saving} onClose={() => { if (!saving) { setItemFormOpen(false); setEditingItem(null); setTargetSectionId(null); } }} onSubmit={saveItem} />
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
