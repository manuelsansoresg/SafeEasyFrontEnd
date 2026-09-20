"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ImageOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { MenuItemForm } from "@/components/admin/menu/MenuItemForm";
import { MenuSectionForm } from "@/components/admin/menu/MenuSectionForm";
import { Toast } from "@/components/ui/Toast";
import { menuService } from "@/services/menuService";
import type {
  Menu,
  MenuCatalogItem,
  MenuDay,
  MenuItem,
  MenuItemPayload,
  MenuSection,
  MenuSectionPayload,
} from "@/types/menu";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type AvailabilityMode = "always" | "days" | "dates";
type PickerMode = "existing" | "new";

const steps = [
  { number: 1, label: "Datos" },
  { number: 2, label: "Disponibilidad" },
  { number: 3, label: "Secciones" },
  { number: 4, label: "Platillos" },
  { number: 5, label: "Revisar" },
] as const;

const dayOptions: { value: MenuDay; short: string; label: string }[] = [
  { value: 0, short: "Lun", label: "Lunes" },
  { value: 1, short: "Mar", label: "Martes" },
  { value: 2, short: "Mié", label: "Miércoles" },
  { value: 3, short: "Jue", label: "Jueves" },
  { value: 4, short: "Vie", label: "Viernes" },
  { value: 5, short: "Sáb", label: "Sábado" },
  { value: 6, short: "Dom", label: "Domingo" },
];

const sectionSuggestions = [
  "Entradas",
  "Platos fuertes",
  "Bebidas",
  "Postres",
  "Desayunos",
  "Ensaladas",
  "Sopas",
  "Combos / Paquetes",
  "Especialidades",
] as const;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 8 * 1024 * 1024;

function validateImage(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }
  if (file.size > maxImageSize) {
    return "La imagen no puede superar 8 MB.";
  }
  return null;
}

function money(value: number | null) {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function getAvailabilityMode(menu: Menu): AvailabilityMode {
  if (menu.date_start || menu.date_end) return "dates";
  if (menu.days_of_week?.length) return "days";
  return "always";
}

function availabilitySummary(menu: Menu) {
  const parts: string[] = [];

  if (menu.date_start && menu.date_end) {
    parts.push(`${menu.date_start} al ${menu.date_end}`);
  } else if (menu.days_of_week?.length) {
    parts.push(
      menu.days_of_week
        .map((day) => dayOptions.find((option) => option.value === day)?.label)
        .filter(Boolean)
        .join(", "),
    );
  } else {
    parts.push("Siempre disponible");
  }

  if (menu.time_start && menu.time_end) {
    parts.push(`${menu.time_start.slice(0, 5)} a ${menu.time_end.slice(0, 5)}`);
  }

  return parts.join(" · ");
}

function clampStep(value: number) {
  return Math.min(5, Math.max(1, Number.isFinite(value) ? value : 1));
}

export function MenuWizard() {
  const router = useRouter();

  const [initializing, setInitializing] = useState(true);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Paso 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Paso 2
  const [availabilityMode, setAvailabilityMode] =
    useState<AvailabilityMode>("always");
  const [days, setDays] = useState<MenuDay[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [limitTime, setLimitTime] = useState(false);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // Paso 3
  const [customSection, setCustomSection] = useState("");
  const [sectionBusy, setSectionBusy] = useState<number | "new" | null>(null);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
  const [sectionFormSaving, setSectionFormSaving] = useState(false);

  // Paso 4
  const [catalog, setCatalog] = useState<MenuCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<number | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>("existing");
  const [pickerSelected, setPickerSelected] = useState<number[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSaving, setPickerSaving] = useState(false);

  // Crear platillo
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishImage, setDishImage] = useState<File | null>(null);
  const [dishImagePreview, setDishImagePreview] = useState<string | null>(null);

  // Edición de platillos existentes dentro del mismo wizard
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingItemSectionId, setEditingItemSectionId] = useState<number | null>(null);
  const [itemFormSaving, setItemFormSaving] = useState(false);
  const [itemImageBusy, setItemImageBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
      if (dishImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(dishImagePreview);
      }
    };
  }, [coverPreview, dishImagePreview]);

  const applyMenuToForm = (value: Menu) => {
    setMenu(value);
    setName(value.name);
    setDescription(value.description ?? "");
    setAvailabilityMode(getAvailabilityMode(value));
    setDays(value.days_of_week ?? []);
    setDateStart(value.date_start ?? "");
    setDateEnd(value.date_end ?? "");
    setLimitTime(Boolean(value.time_start && value.time_end));
    setTimeStart(value.time_start?.slice(0, 5) ?? "");
    setTimeEnd(value.time_end?.slice(0, 5) ?? "");
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const rawId = params.get("menuId");

        if (!rawId) {
          if (active) setInitializing(false);
          return;
        }

        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0) {
          throw new Error("El borrador indicado no es válido.");
        }

        const loaded = await menuService.detail(id);
        if (!active) return;

        applyMenuToForm(loaded);
        // Un menú publicado entra al mismo wizard desde el paso 1 para editarlo.
        // Un borrador continúa exactamente donde se quedó.
        setStep(loaded.setup_completed ? 1 : clampStep(loaded.setup_step));
      } catch (error) {
        if (!active) return;
        setPageError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el borrador del menú.",
        );
      } finally {
        if (active) setInitializing(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const refreshMenu = async (menuId = menu?.id) => {
    if (!menuId) return null;
    const fresh = await menuService.detail(menuId);
    applyMenuToForm(fresh);
    return fresh;
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const data = await menuService.listCatalog({ activeOnly: true });
      setCatalog(data);
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar tus platillos.",
      });
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (step === 4) void loadCatalog();
  }, [step]);

  const currentPickerSection = useMemo(
    () => menu?.sections.find((section) => section.id === pickerSectionId) ?? null,
    [menu, pickerSectionId],
  );

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) =>
      [item.name, item.description ?? "", item.label ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [catalog, pickerSearch]);

  const totalItems = useMemo(
    () =>
      menu?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0,
    [menu],
  );

  const chooseCover = (file?: File) => {
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setStepError(null);
  };

  const chooseDishImage = (file?: File) => {
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    if (dishImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(dishImagePreview);
    }
    setDishImage(file);
    setDishImagePreview(URL.createObjectURL(file));
    setStepError(null);
  };

  const persistStep1 = async () => {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new Error("Escribe un nombre para tu menú.");
    }

    let current = menu;

    if (!current) {
      current = await menuService.create({
        name: cleanName,
        description: description.trim() || null,
        price: null,
        date_start: null,
        date_end: null,
        days_of_week: null,
        time_start: null,
        time_end: null,
        is_active: false,
        display_order: 0,
        wizard_mode: true,
      });
      router.replace(`/admin/menu/nuevo?menuId=${current.id}`);
    } else {
      current = await menuService.update(current.id, {
        name: cleanName,
        description: description.trim() || null,
      });
    }

    if (coverFile) {
      current = await menuService.uploadImage(current.id, coverFile);
      setCoverFile(null);
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }

    applyMenuToForm(current);
    return current;
  };

  const continueFromStep1 = async (exitAfterSave = false) => {
    setSaving(true);
    setStepError(null);
    try {
      const saved = await persistStep1();
      if (exitAfterSave) {
        router.push("/admin/menu");
        return;
      }
      if (saved.setup_completed) {
        applyMenuToForm(saved);
        setStep(2);
      } else {
        const progressed = await menuService.updateSetupProgress(saved.id, 2);
        applyMenuToForm(progressed);
        setStep(2);
      }
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo guardar el menú.",
      );
    } finally {
      setSaving(false);
    }
  };

  const persistStep2 = async () => {
    if (!menu) throw new Error("Primero guarda los datos del menú.");

    if (availabilityMode === "days" && days.length === 0) {
      throw new Error("Selecciona al menos un día.");
    }

    if (availabilityMode === "dates" && (!dateStart || !dateEnd)) {
      throw new Error("Selecciona la fecha inicial y la fecha final.");
    }

    if (dateStart && dateEnd && dateEnd < dateStart) {
      throw new Error("La fecha final no puede ser anterior a la inicial.");
    }

    if (limitTime && (!timeStart || !timeEnd)) {
      throw new Error("Indica la hora inicial y la hora final.");
    }

    const updated = await menuService.update(menu.id, {
      date_start: availabilityMode === "dates" ? dateStart : null,
      date_end: availabilityMode === "dates" ? dateEnd : null,
      days_of_week: availabilityMode === "days" ? days : null,
      time_start: limitTime ? timeStart : null,
      time_end: limitTime ? timeEnd : null,
    });

    applyMenuToForm(updated);
    return updated;
  };

  const continueFromStep2 = async (exitAfterSave = false) => {
    setSaving(true);
    setStepError(null);
    try {
      const saved = await persistStep2();
      if (exitAfterSave) {
        router.push("/admin/menu");
        return;
      }
      if (saved.setup_completed) {
        applyMenuToForm(saved);
        setStep(3);
      } else {
        const progressed = await menuService.updateSetupProgress(saved.id, 3);
        applyMenuToForm(progressed);
        setStep(3);
      }
    } catch (error) {
      setStepError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la disponibilidad.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addSection = async (sectionName: string) => {
    if (!menu) return;
    const cleanName = sectionName.trim();
    if (!cleanName) return;

    if (
      menu.sections.some(
        (section) => section.name.trim().toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      setStepError("Esa sección ya está en tu menú.");
      return;
    }

    setSectionBusy("new");
    setStepError(null);
    try {
      await menuService.createSection(menu.id, {
        name: cleanName,
        description: null,
        is_active: true,
        display_order: menu.sections.length,
      });
      await refreshMenu(menu.id);
      setCustomSection("");
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo agregar la sección.",
      );
    } finally {
      setSectionBusy(null);
    }
  };

  const openEditSection = (section: MenuSection) => {
    setEditingSection(section);
    setSectionFormOpen(true);
    setStepError(null);
  };

  const saveEditedSection = async (payload: MenuSectionPayload) => {
    if (!menu || !editingSection) return;

    setSectionFormSaving(true);
    setStepError(null);
    try {
      await menuService.updateSection(menu.id, editingSection.id, payload);
      await refreshMenu(menu.id);
      setSectionFormOpen(false);
      setEditingSection(null);
      setToast({ type: "success", message: "Sección actualizada." });
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo actualizar la sección.",
      );
    } finally {
      setSectionFormSaving(false);
    }
  };

  const removeSection = async (section: MenuSection) => {
    if (!menu) return;
    const accepted = window.confirm(
      section.items.length
        ? `¿Quitar la sección "${section.name}"? Los platillos seguirán guardados para reutilizarlos.`
        : `¿Quitar la sección "${section.name}"?`,
    );
    if (!accepted) return;

    setSectionBusy(section.id);
    try {
      await menuService.removeSection(menu.id, section.id);
      await refreshMenu(menu.id);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo quitar la sección.",
      );
    } finally {
      setSectionBusy(null);
    }
  };

  const continueFromStep3 = async (exitAfterSave = false) => {
    if (!menu) return;

    if (!exitAfterSave && menu.sections.length === 0) {
      setStepError("Agrega al menos una sección para continuar.");
      return;
    }

    setSaving(true);
    setStepError(null);
    try {
      if (exitAfterSave) {
        if (!menu.setup_completed) {
          await menuService.updateSetupProgress(menu.id, 3);
        }
        router.push("/admin/menu");
        return;
      }
      if (menu.setup_completed) {
        setStep(4);
      } else {
        const progressed = await menuService.updateSetupProgress(menu.id, 4);
        applyMenuToForm(progressed);
        setStep(4);
      }
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo guardar el avance.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPicker = (section: MenuSection) => {
    setPickerSectionId(section.id);
    setPickerSelected(section.items.map((item) => item.id));
    setPickerSearch("");
    setPickerMode(catalog.length ? "existing" : "new");
    setDishName("");
    setDishDescription("");
    setDishPrice("");
    setDishImage(null);
    if (dishImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(dishImagePreview);
    }
    setDishImagePreview(null);
    setStepError(null);
  };

  const closePicker = (force = false) => {
    if (pickerSaving && !force) return;
    setPickerSectionId(null);
    setPickerSelected([]);
    setPickerSearch("");
    setDishImage(null);
    if (dishImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(dishImagePreview);
    }
    setDishImagePreview(null);
  };

  const toggleCatalogSelection = (itemId: number) => {
    setPickerSelected((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const saveExistingSelection = async () => {
    if (!menu || !currentPickerSection) return;

    setPickerSaving(true);
    setStepError(null);
    try {
      const currentIds = currentPickerSection.items.map((item) => item.id);
      const selected = new Set(pickerSelected);
      const current = new Set(currentIds);

      const addIds = pickerSelected.filter((itemId) => !current.has(itemId));
      const removeIds = currentIds.filter((itemId) => !selected.has(itemId));

      if (addIds.length) {
        await menuService.attachItems(menu.id, currentPickerSection.id, {
          items: addIds.map((itemId, index) => ({
            item_id: itemId,
            is_active: true,
            is_available: true,
            display_order: currentPickerSection.items.length + index,
          })),
        });
      }

      if (removeIds.length) {
        await Promise.all(
          removeIds.map((itemId) =>
            menuService.removeItem(menu.id, currentPickerSection.id, itemId),
          ),
        );
      }

      await refreshMenu(menu.id);
      setToast({ type: "success", message: "Platillos actualizados." });
      closePicker(true);
    } catch (error) {
      setStepError(
        error instanceof Error
          ? error.message
          : "No se pudieron actualizar los platillos.",
      );
    } finally {
      setPickerSaving(false);
    }
  };

  const createDish = async () => {
    if (!menu || !currentPickerSection) return;
    const cleanName = dishName.trim();
    if (!cleanName) {
      setStepError("Escribe el nombre del platillo.");
      return;
    }

    const parsedPrice = dishPrice.trim() === "" ? null : Number(dishPrice);
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setStepError("Escribe un precio válido.");
      return;
    }

    setPickerSaving(true);
    setStepError(null);
    try {
      let created = await menuService.createItem(menu.id, currentPickerSection.id, {
        name: cleanName,
        description: dishDescription.trim() || null,
        price: parsedPrice,
        old_price: null,
        label: null,
        is_active: true,
        is_available: true,
        display_order: currentPickerSection.items.length,
      });

      if (dishImage) {
        created = await menuService.uploadItemImage(
          menu.id,
          currentPickerSection.id,
          created.id,
          dishImage,
        );
      }

      await Promise.all([refreshMenu(menu.id), loadCatalog()]);
      setToast({
        type: "success",
        message: `${created.name} se agregó y quedó guardado para reutilizarlo.`,
      });
      closePicker(true);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo crear el platillo.",
      );
    } finally {
      setPickerSaving(false);
    }
  };

  const openEditItem = (sectionId: number, item: MenuItem) => {
    setEditingItemSectionId(sectionId);
    setEditingItem(item);
    setItemFormOpen(true);
    setStepError(null);
  };

  const saveEditedItem = async (payload: MenuItemPayload) => {
    if (!menu || !editingItem || editingItemSectionId == null) return;

    setItemFormSaving(true);
    setStepError(null);
    try {
      await menuService.updateItem(
        menu.id,
        editingItemSectionId,
        editingItem.id,
        payload,
      );
      await Promise.all([refreshMenu(menu.id), loadCatalog()]);
      setItemFormOpen(false);
      setEditingItem(null);
      setEditingItemSectionId(null);
      setToast({ type: "success", message: "Platillo actualizado." });
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo actualizar el platillo.",
      );
    } finally {
      setItemFormSaving(false);
    }
  };

  const uploadExistingItemImage = async (
    sectionId: number,
    itemId: number,
    file?: File,
  ) => {
    if (!menu || !file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    setItemImageBusy(itemId);
    setStepError(null);
    try {
      await menuService.uploadItemImage(menu.id, sectionId, itemId, file);
      await Promise.all([refreshMenu(menu.id), loadCatalog()]);
      setToast({ type: "success", message: "Foto actualizada." });
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo actualizar la foto.",
      );
    } finally {
      setItemImageBusy(null);
    }
  };

  const deleteExistingItemImage = async (sectionId: number, itemId: number) => {
    if (!menu) return;
    setItemImageBusy(itemId);
    setStepError(null);
    try {
      await menuService.deleteItemImage(menu.id, sectionId, itemId);
      await Promise.all([refreshMenu(menu.id), loadCatalog()]);
      setToast({ type: "success", message: "Foto eliminada." });
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo eliminar la foto.",
      );
    } finally {
      setItemImageBusy(null);
    }
  };

  const removeItemFromSection = async (section: MenuSection, item: MenuItem) => {
    if (!menu) return;
    const accepted = window.confirm(
      `¿Quitar "${item.name}" de ${section.name}? El platillo seguirá guardado para reutilizarlo.`,
    );
    if (!accepted) return;

    setSaving(true);
    try {
      await menuService.removeItem(menu.id, section.id, item.id);
      await refreshMenu(menu.id);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo quitar el platillo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const continueFromStep4 = async (exitAfterSave = false) => {
    if (!menu) return;

    if (!exitAfterSave && totalItems === 0) {
      setStepError("Agrega al menos un platillo para continuar.");
      return;
    }

    setSaving(true);
    setStepError(null);
    try {
      if (exitAfterSave) {
        if (!menu.setup_completed) {
          await menuService.updateSetupProgress(menu.id, 4);
        }
        router.push("/admin/menu");
        return;
      }

      if (menu.setup_completed) {
        setStep(5);
      } else {
        const progressed = await menuService.updateSetupProgress(menu.id, 5);
        applyMenuToForm(progressed);
        setStep(5);
      }
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo guardar el avance.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publishMenu = async () => {
    if (!menu) return;
    setSaving(true);
    setStepError(null);
    try {
      await menuService.publish(menu.id);
      setToast({ type: "success", message: "Menú publicado correctamente." });
      window.setTimeout(() => router.push("/admin/menu"), 450);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo publicar el menú.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveAndExit = async () => {
    if (step === 1) {
      await continueFromStep1(true);
      return;
    }
    if (step === 2) {
      await continueFromStep2(true);
      return;
    }
    if (step === 3) {
      await continueFromStep3(true);
      return;
    }
    if (step === 4) {
      await continueFromStep4(true);
      return;
    }
    router.push("/admin/menu");
  };

  const goBack = async () => {
    if (step <= 1) {
      router.push("/admin/menu");
      return;
    }

    const previous = step - 1;
    setStepError(null);
    setStep(previous);

    if (menu && !menu.setup_completed) {
      try {
        const updated = await menuService.updateSetupProgress(menu.id, previous);
        setMenu(updated);
      } catch {
        // No bloqueamos la navegación si solo falla guardar la posición.
      }
    }
  };

  const deleteCover = async () => {
    if (coverFile) {
      setCoverFile(null);
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
      return;
    }

    if (!menu?.image_url) {
      setCoverPreview(null);
      return;
    }

    setSaving(true);
    try {
      const updated = await menuService.deleteImage(menu.id);
      applyMenuToForm(updated);
      setCoverFile(null);
      setCoverPreview(null);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "No se pudo quitar la imagen.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (initializing) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 size={34} className="animate-spin text-[#168e00]" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">No pudimos abrir este menú</h1>
        <p className="mt-2 text-sm text-red-600">{pageError}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/menu")}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 font-semibold text-white"
        >
          <ArrowLeft size={17} /> Volver a Menú
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/menu")}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#004e28]"
          >
            <ArrowLeft size={16} /> Volver a mis menús
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">
            Alta guiada
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] sm:text-4xl">
            {menu?.setup_completed
              ? "Edita tu menú"
              : menu
                ? "Configura tu menú"
                : "Crea tu menú"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            {menu?.setup_completed
              ? "Recorre los pasos y cambia solo lo que necesites."
              : "Solo sigue los pasos. Puedes guardar y continuar después."}
          </p>
        </div>

        {menu && !menu.setup_completed ? (
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            Borrador guardado
          </span>
        ) : null}
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex min-w-[620px] items-center">
          {steps.map((item, index) => {
            const isCurrent = step === item.number;
            const isDone = step > item.number || Boolean(menu?.setup_completed);
            return (
              <div key={item.number} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                      isCurrent
                        ? "bg-[#168e00] text-white"
                        : isDone
                          ? "bg-[#004e28] text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isDone && !isCurrent ? <Check size={15} /> : item.number}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isCurrent ? "text-[#004e28]" : "text-gray-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {index < steps.length - 1 ? (
                  <div
                    className={`mx-3 h-px flex-1 ${
                      step > item.number ? "bg-[#168e00]/40" : "bg-gray-200"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {stepError && !pickerSectionId ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {stepError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {step === 1 ? (
          <div className="p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                Paso 1 de 5
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">Datos básicos</h2>
              <p className="mt-1 text-sm text-gray-500">
                Pon un nombre claro. Lo demás es opcional.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Nombre del menú *
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={150}
                    autoFocus
                    placeholder="Ej. Menú del día"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                  <span className="mt-1.5 block text-xs text-gray-400">
                    Ejemplo: Menú del día, Desayunos o Fin de semana.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Descripción <span className="font-normal text-gray-400">(opcional)</span>
                  </span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="Ej. Comida casera preparada todos los días."
                    className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                  />
                </label>
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Foto de portada <span className="font-normal text-gray-400">(opcional)</span>
                </span>
                <label className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 transition hover:border-[#168e00]/50 hover:bg-[#168e00]/5">
                  {coverPreview || menu?.image_thumbnail_url || menu?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPreview || menu?.image_thumbnail_url || menu?.image_url || ""}
                      alt="Portada del menú"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ImagePlus className="mx-auto" size={32} />
                      <span className="mt-2 block text-sm font-semibold">Agregar foto</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      chooseCover(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-gray-400">
                  JPG, PNG o WebP. Máximo 8 MB.
                </p>
                {coverPreview || menu?.image_url ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteCover()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    <Trash2 size={14} /> Quitar foto
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                Paso 2 de 5
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">¿Cuándo estará disponible?</h2>
              <p className="mt-1 text-sm text-gray-500">
                Elige la opción más simple para tu negocio.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {([
                {
                  value: "always" as AvailabilityMode,
                  title: "Siempre",
                  help: "Se muestra todos los días.",
                  icon: Store,
                },
                {
                  value: "days" as AvailabilityMode,
                  title: "Días específicos",
                  help: "Ej. lunes a viernes.",
                  icon: CalendarDays,
                },
                {
                  value: "dates" as AvailabilityMode,
                  title: "Por fechas",
                  help: "Ideal para temporada o evento.",
                  icon: CalendarDays,
                },
              ] as const).map((option) => {
                const Icon = option.icon;
                const selected = availabilityMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setAvailabilityMode(option.value);
                      setStepError(null);
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-[#168e00] bg-[#168e00]/5 shadow-sm"
                        : "border-gray-200 hover:border-[#168e00]/30"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        selected
                          ? "bg-[#168e00] text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon size={19} />
                    </span>
                    <strong className="mt-3 block text-gray-900">{option.title}</strong>
                    <span className="mt-1 block text-xs text-gray-500">{option.help}</span>
                  </button>
                );
              })}
            </div>

            {availabilityMode === "days" ? (
              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700">Selecciona los días</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dayOptions.map((day) => {
                    const selected = days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          setDays((current) =>
                            current.includes(day.value)
                              ? current.filter((value) => value !== day.value)
                              : [...current, day.value].sort((a, b) => a - b),
                          )
                        }
                        className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                          selected
                            ? "bg-[#168e00] text-white"
                            : "border border-gray-200 bg-white text-gray-600"
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {availabilityMode === "dates" ? (
              <div className="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Desde
                  </span>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(event) => setDateStart(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#168e00]"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Hasta
                  </span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(event) => setDateEnd(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#168e00]"
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-gray-200 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={limitTime}
                  onChange={(event) => setLimitTime(event.target.checked)}
                  className="h-5 w-5 accent-[#168e00]"
                />
                <div>
                  <p className="font-semibold text-gray-800">También usar un horario</p>
                  <p className="text-xs text-gray-500">Opcional. Ej. de 8:00 a 13:00.</p>
                </div>
              </label>

              {limitTime ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Hora inicial
                    </span>
                    <input
                      type="time"
                      value={timeStart}
                      onChange={(event) => setTimeStart(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Hora final
                    </span>
                    <input
                      type="time"
                      value={timeEnd}
                      onChange={(event) => setTimeEnd(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                Paso 3 de 5
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">Crea tus secciones</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sirven para ordenar el menú. Ej. Platos fuertes, Bebidas y Postres.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">Sugerencias</p>
              <div className="flex flex-wrap gap-2">
                {sectionSuggestions.map((suggestion) => {
                  const exists = menu?.sections.some(
                    (section) =>
                      section.name.trim().toLowerCase() === suggestion.toLowerCase(),
                  );
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={Boolean(exists) || sectionBusy !== null}
                      onClick={() => void addSection(suggestion)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        exists
                          ? "border-[#168e00]/20 bg-[#168e00]/10 text-[#168e00]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-[#168e00]/40 hover:text-[#168e00]"
                      } disabled:cursor-default`}
                    >
                      {exists ? <Check size={14} /> : <Plus size={14} />}
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                value={customSection}
                onChange={(event) => setCustomSection(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addSection(customSection);
                  }
                }}
                maxLength={150}
                placeholder="Otra sección..."
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
              />
              <button
                type="button"
                disabled={!customSection.trim() || sectionBusy !== null}
                onClick={() => void addSection(customSection)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 font-semibold text-white disabled:opacity-40"
              >
                {sectionBusy === "new" ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Plus size={17} />
                )}
                Agregar
              </button>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Tus secciones</h3>
                <span className="text-xs font-semibold text-gray-400">
                  {menu?.sections.length ?? 0} creadas
                </span>
              </div>

              {!menu?.sections.length ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
                  Elige una sugerencia para empezar.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {menu.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#168e00] shadow-sm">
                          {index + 1}
                        </span>
                        <span className="truncate font-semibold text-gray-800">
                          {section.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={sectionBusy !== null}
                          onClick={() => openEditSection(section)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-[#168e00] disabled:opacity-40"
                          aria-label={`Editar ${section.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={sectionBusy !== null}
                          onClick={() => void removeSection(section)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          aria-label={`Quitar ${section.name}`}
                        >
                          {sectionBusy === section.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                Paso 4 de 5
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">Agrega tus platillos</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Un platillo se guarda una sola vez. Después puedes usarlo en otros menús sin volver a capturarlo.
              </p>
            </div>

            {catalogLoading ? (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Cargando tus platillos...
              </div>
            ) : null}

            <div className="space-y-4">
              {menu?.sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#004e28]">{section.name}</h3>
                      <p className="text-xs text-gray-500">
                        {section.items.length
                          ? `${section.items.length} platillo${section.items.length === 1 ? "" : "s"}`
                          : "Todavía no tiene platillos"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPicker(section)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#117500]"
                    >
                      <Plus size={16} /> Agregar platillos
                    </button>
                  </div>

                  {section.items.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {section.items.map((item) => (
                        <div key={item.id} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eaf1eb]">
                            {item.image_thumbnail_url || item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image_thumbnail_url || item.image_url || ""}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UtensilsCrossed size={20} className="text-[#004e28]/25" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-gray-800">{item.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-[#168e00]">
                              {money(item.price)}
                            </p>
                            <p className={`mt-1 text-[0.68rem] font-semibold ${
                              item.is_available ? "text-emerald-600" : "text-amber-600"
                            }`}>
                              {item.is_available ? "Disponible" : "Agotado"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={saving || itemImageBusy === item.id}
                                onClick={() => openEditItem(section.id, item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[0.7rem] font-semibold text-gray-600 hover:border-[#168e00]/30 hover:text-[#168e00]"
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[0.7rem] font-semibold text-gray-600 hover:border-[#168e00]/30 hover:text-[#168e00]">
                                {itemImageBusy === item.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Camera size={12} />
                                )}
                                Foto
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  disabled={saving || itemImageBusy === item.id}
                                  onChange={(event) => {
                                    void uploadExistingItemImage(
                                      section.id,
                                      item.id,
                                      event.target.files?.[0],
                                    );
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              {item.image_url ? (
                                <button
                                  type="button"
                                  disabled={saving || itemImageBusy === item.id}
                                  onClick={() => void deleteExistingItemImage(section.id, item.id)}
                                  className="inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-gray-400 hover:text-red-500"
                                  aria-label={`Quitar foto de ${item.name}`}
                                >
                                  <ImageOff size={12} />
                                </button>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={saving || itemImageBusy === item.id}
                              onClick={() => void removeItemFromSection(section, item)}
                              className="mt-2 text-[0.7rem] font-semibold text-red-500"
                            >
                              Quitar de esta sección
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 && menu ? (
          <div className="p-5 sm:p-7">
            <div className="mb-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
                <Check size={28} />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                Paso 5 de 5
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {menu.setup_completed ? "Revisa tus cambios" : "Todo listo para publicar"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {menu.setup_completed
                  ? "Tus datos, secciones y platillos se conservaron. Verifica que todo esté como quieres."
                  : "Revisa lo básico. Siempre podrás editarlo después."}
              </p>
            </div>

            <div className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eaf1eb] sm:w-32">
                    {menu.image_thumbnail_url || menu.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={menu.image_thumbnail_url || menu.image_url || ""}
                        alt={menu.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed size={30} className="text-[#004e28]/25" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-[#004e28]">{menu.name}</h3>
                    {menu.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{menu.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <CalendarDays size={18} className="text-[#168e00]" />
                  <p className="mt-2 text-xs font-semibold text-gray-400">Disponibilidad</p>
                  <p className="mt-1 text-sm font-bold text-gray-800">{availabilitySummary(menu)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <Store size={18} className="text-[#168e00]" />
                  <p className="mt-2 text-xs font-semibold text-gray-400">Secciones</p>
                  <p className="mt-1 text-2xl font-black text-gray-800">{menu.sections.length}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <UtensilsCrossed size={18} className="text-[#168e00]" />
                  <p className="mt-2 text-xs font-semibold text-gray-400">Platillos</p>
                  <p className="mt-1 text-2xl font-black text-gray-800">{totalItems}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#168e00]/15 bg-[#168e00]/5 p-4 text-sm leading-6 text-[#004e28]">
                {menu.setup_completed
                  ? "Los cambios se guardan sobre este mismo menú; no se duplican secciones ni platillos."
                  : "Al publicar, el menú quedará visible en la página de tu negocio. Puedes desactivarlo o editarlo cuando quieras."}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={() => void goBack()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={17} /> {step === 1 ? "Cancelar" : "Anterior"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAndExit()}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-white disabled:opacity-50"
            >
              Guardar y salir
            </button>
          </div>

          {step === 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void continueFromStep1(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Continuar <ArrowRight size={17} />
            </button>
          ) : null}

          {step === 2 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void continueFromStep2(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Continuar <ArrowRight size={17} />
            </button>
          ) : null}

          {step === 3 ? (
            <button
              type="button"
              disabled={saving || sectionBusy !== null}
              onClick={() => void continueFromStep3(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Continuar <ArrowRight size={17} />
            </button>
          ) : null}

          {step === 4 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void continueFromStep4(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Revisar <ArrowRight size={17} />
            </button>
          ) : null}

          {step === 5 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                menu?.setup_completed
                  ? router.push("/admin/menu")
                  : void publishMenu()
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-6 py-3 font-black text-white shadow-sm hover:bg-[#117500] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {menu?.setup_completed ? "Terminar edición" : "Publicar menú"}
            </button>
          ) : null}
        </div>
      </div>

      {pickerSectionId && currentPickerSection ? (
        <div
          className="fixed inset-0 z-[22000] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Agregar platillos a ${currentPickerSection.name}`}
          onClick={() => closePicker()}
        >
          <div
            className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">
                  {currentPickerSection.name}
                </p>
                <h3 className="mt-1 text-xl font-black text-gray-900">Agregar platillos</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Usa uno que ya tienes o crea uno nuevo.
                </p>
              </div>
              <button
                type="button"
                disabled={pickerSaving}
                onClick={() => closePicker()}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            {stepError ? (
              <div className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-6">
                {stepError}
              </div>
            ) : null}

            <div className="border-b border-gray-100 px-5 pt-4 sm:px-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickerMode("existing")}
                  className={`rounded-t-xl px-4 py-3 text-sm font-bold ${
                    pickerMode === "existing"
                      ? "bg-[#168e00]/10 text-[#004e28]"
                      : "text-gray-400"
                  }`}
                >
                  Usar existentes
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode("new")}
                  className={`rounded-t-xl px-4 py-3 text-sm font-bold ${
                    pickerMode === "new"
                      ? "bg-[#168e00]/10 text-[#004e28]"
                      : "text-gray-400"
                  }`}
                >
                  Crear nuevo
                </button>
              </div>
            </div>

            {pickerMode === "existing" ? (
              <div className="p-5 sm:p-6">
                {catalog.length ? (
                  <>
                    <label className="relative block">
                      <Search
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        value={pickerSearch}
                        onChange={(event) => setPickerSearch(event.target.value)}
                        placeholder="Buscar platillo..."
                        className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#168e00]"
                      />
                    </label>

                    <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                      {filteredCatalog.length ? (
                        filteredCatalog.map((item) => {
                          const selected = pickerSelected.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleCatalogSelection(item.id)}
                              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                                selected
                                  ? "border-[#168e00] bg-[#168e00]/5"
                                  : "border-gray-100 hover:border-[#168e00]/30"
                              }`}
                            >
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                                {item.image_thumbnail_url || item.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.image_thumbnail_url || item.image_url || ""}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <UtensilsCrossed size={20} className="text-gray-300" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-gray-800">{item.name}</p>
                                <p className="mt-0.5 text-xs font-semibold text-[#168e00]">
                                  {money(item.price)}
                                </p>
                              </div>
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-[#168e00] bg-[#168e00] text-white"
                                    : "border-gray-300 text-transparent"
                                }`}
                              >
                                <Check size={14} />
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="py-8 text-center text-sm text-gray-400">
                          No encontramos platillos con esa búsqueda.
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={pickerSaving}
                        onClick={() => closePicker()}
                        className="rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={pickerSaving}
                        onClick={() => void saveExistingSelection()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white disabled:opacity-50"
                      >
                        {pickerSaving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                        Guardar selección
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <UtensilsCrossed className="mx-auto text-gray-300" size={32} />
                    <h4 className="mt-3 font-bold text-gray-800">Aún no tienes platillos guardados</h4>
                    <p className="mt-1 text-sm text-gray-500">Crea el primero y después podrás reutilizarlo.</p>
                    <button
                      type="button"
                      onClick={() => setPickerMode("new")}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-bold text-white"
                    >
                      <Plus size={17} /> Crear platillo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre *</span>
                      <input
                        value={dishName}
                        onChange={(event) => setDishName(event.target.value)}
                        maxLength={180}
                        placeholder="Ej. Cochinita pibil"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                        Precio <span className="font-normal text-gray-400">(opcional)</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dishPrice}
                        onChange={(event) => setDishPrice(event.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                        Descripción <span className="font-normal text-gray-400">(opcional)</span>
                      </span>
                      <textarea
                        value={dishDescription}
                        onChange={(event) => setDishDescription(event.target.value)}
                        rows={3}
                        maxLength={5000}
                        placeholder="Una descripción breve del platillo."
                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]"
                      />
                    </label>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Foto <span className="font-normal text-gray-400">(opcional)</span>
                    </span>
                    <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 hover:border-[#168e00]/40">
                      {dishImagePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dishImagePreview}
                          alt="Vista previa"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-gray-400">
                          <Camera className="mx-auto" size={28} />
                          <span className="mt-2 block text-xs font-semibold">Agregar foto</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          chooseDishImage(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-[#168e00]/5 p-3 text-xs leading-5 text-[#004e28]">
                  Este platillo quedará guardado. Si aparece también el martes o en otro menú, solo lo seleccionas y no lo vuelves a capturar.
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={pickerSaving}
                    onClick={() => closePicker()}
                    className="rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pickerSaving}
                    onClick={() => void createDish()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {pickerSaving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                    Crear y agregar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <MenuSectionForm
        open={sectionFormOpen}
        section={editingSection}
        saving={sectionFormSaving}
        onClose={() => {
          if (!sectionFormSaving) {
            setSectionFormOpen(false);
            setEditingSection(null);
          }
        }}
        onSubmit={saveEditedSection}
      />

      <MenuItemForm
        open={itemFormOpen}
        item={editingItem}
        saving={itemFormSaving}
        onClose={() => {
          if (!itemFormSaving) {
            setItemFormOpen(false);
            setEditingItem(null);
            setEditingItemSectionId(null);
          }
        }}
        onSubmit={saveEditedItem}
      />

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
