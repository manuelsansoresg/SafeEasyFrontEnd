"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { businessTypeService } from "@/services/businessTypeService";
import type { BusinessTypeAdminList } from "@/types/businessType";
import type { PlanImageLimitInput } from "@/types/subscriptions";

const MAX_LIMIT = 2_147_483_647;
const limitFields = [
  { key: "max_gallery_images", label: "Imágenes en galería" },
  { key: "max_images_per_product", label: "Imágenes por producto" },
] as const;

export type ImageLimitDraft = {
  key: number;
  business_type_id: string;
  max_gallery_images: string;
  max_images_per_product: string;
  is_active: boolean;
};

export function emptyImageLimitDraft(key: number): ImageLimitDraft {
  return {
    key,
    business_type_id: "",
    max_gallery_images: "",
    max_images_per_product: "",
    is_active: true,
  };
}

export function parseImageLimitDrafts(rows: ImageLimitDraft[]): PlanImageLimitInput[] | null {
  const rules = rows.map(({ business_type_id, max_gallery_images, max_images_per_product, is_active }) => ({
    business_type_id: Number(business_type_id),
    max_gallery_images: max_gallery_images.trim() ? Number(max_gallery_images) : NaN,
    max_images_per_product: max_images_per_product.trim() ? Number(max_images_per_product) : NaN,
    is_active,
  }));
  const valid = rules.every((rule) =>
    Number.isInteger(rule.business_type_id) && rule.business_type_id > 0 && rule.business_type_id <= MAX_LIMIT &&
    limitFields.every(({ key }) => Number.isInteger(rule[key]) && rule[key] >= 0 && rule[key] <= MAX_LIMIT),
  );
  return valid && new Set(rules.map((rule) => rule.business_type_id)).size === rules.length ? rules : null;
}

interface Props {
  enabled: boolean;
  disabled: boolean;
  supported: boolean;
  rows: ImageLimitDraft[];
  onToggle: (checked: boolean) => void;
  onChange: (rows: ImageLimitDraft[]) => void;
}

const fieldClass = "block w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function PlanImageLimitsFields({ enabled, disabled, supported, rows, onToggle, onChange }: Props) {
  const [catalog, setCatalog] = useState<BusinessTypeAdminList[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [nextKey, setNextKey] = useState(() => rows.length + 1);

  useEffect(() => {
    if (!enabled || catalog) return;
    const controller = new AbortController();
    businessTypeService.listAll(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo.");
        }
      });
    return () => controller.abort();
  }, [enabled, catalog, attempt]);

  const updateRow = (key: number, changes: Partial<ImageLimitDraft>) => {
    onChange(rows.map((row) => row.key === key ? { ...row, ...changes } : row));
  };

  const addRow = () => {
    onChange([...rows, emptyImageLimitDraft(nextKey)]);
    setNextKey(nextKey + 1);
  };

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-2xl border border-[#004e28]/15 bg-[#f2f3f4] p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-primary">Límites especiales por tipo de negocio</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configura límites de imágenes diferentes para tipos de negocio específicos. Los proveedores que no coincidan con estas configuraciones conservarán los límites generales del plan.
        </p>
      </div>

      {supported ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[#168e00]" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
          Configurar límites especiales
        </label>
      ) : (
        <p role="status" className="text-sm text-amber-800">La API no devolvió las reglas especiales de este plan. Puedes editar sus datos generales.</p>
      )}

      {!enabled && rows.length > 0 && (
        <p className="text-sm text-gray-600">Al guardar, se conservarán inactivas las reglas existentes y las nuevas reglas completas. Puedes volver a mostrarlas y activar cada regla desde su casilla.</p>
      )}

      {enabled && (
        <>
          {!catalog && !error && (
            <p role="status" className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" /> Cargando clasificaciones…
            </p>
          )}
          {!catalog && error && (
            <div role="alert" className="text-sm text-red-700">
              {error}{" "}
              <button type="button" className="font-semibold underline" onClick={() => { setError(null); setAttempt(attempt + 1); }}>Reintentar</button>
            </div>
          )}

          {rows.map((row, index) => {
            const selected = Number(row.business_type_id);
            const chosen = catalog?.find((item) => item.id === selected);
            const used = new Set(rows.filter((other) => other.key !== row.key).map((other) => Number(other.business_type_id)));
            const showSavedOption = selected > 0 && (!chosen || !chosen.is_active);
            return (
              <fieldset key={row.key} className="min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white px-3 pb-3 sm:px-4">
                <legend className="px-1 text-sm font-medium text-primary">Regla {index + 1}</legend>
                <label className="block space-y-1 text-sm">
                  <span>Clasificación de negocio</span>
                  <select
                    required
                    className={fieldClass}
                    value={row.business_type_id}
                    disabled={!catalog}
                    onChange={(event) => updateRow(row.key, { business_type_id: event.target.value })}
                  >
                    <option value="">Selecciona una clasificación</option>
                    {showSavedOption && <option value={selected}>{chosen ? `${chosen.name} (inactiva)` : `Clasificación #${selected}`}</option>}
                    {catalog?.filter((item) => item.is_active).map((item) => (
                      <option key={item.id} value={item.id} disabled={used.has(item.id)}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {limitFields.map(({ key, label }) => (
                    <label key={key} className="block space-y-1 text-sm">
                      <span>{label}</span>
                      <input required type="number" inputMode="numeric" min={0} max={MAX_LIMIT} step={1} className={fieldClass}
                        value={row[key]} onChange={(event) => updateRow(row.key, { [key]: event.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[#168e00]" checked={row.is_active} onChange={(event) => updateRow(row.key, { is_active: event.target.checked })} />
                    Regla activa
                  </label>
                  <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-red-700" aria-label={`Eliminar regla ${index + 1}`} onClick={() => onChange(rows.filter((item) => item.key !== row.key))}>
                    <Trash2 size={15} /> Eliminar
                  </button>
                </div>
              </fieldset>
            );
          })}
          {catalog && !catalog.some((item) => item.is_active) && (
            <p className="text-sm text-gray-600">El catálogo no tiene clasificaciones activas disponibles.</p>
          )}
          <p className="text-xs text-gray-600">Usa 0 para impedir nuevas cargas de imágenes en el campo correspondiente.</p>
          <button type="button" disabled={!catalog?.some((item) => item.is_active && !rows.some((row) => Number(row.business_type_id) === item.id))}
            onClick={addRow} className="inline-flex items-center gap-1 text-sm font-semibold text-[#004e28] disabled:opacity-50"
          >
            <Plus size={16} /> Agregar otra clasificación
          </button>
        </>
      )}
    </fieldset>
  );
}
