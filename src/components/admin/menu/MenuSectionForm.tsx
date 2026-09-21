"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import type {
  MenuSection,
  MenuSectionPayload,
} from "@/types/menu";

type Props = {
  open: boolean;
  section?: MenuSection | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (
    payload: MenuSectionPayload,
  ) => Promise<void> | void;
};

const SECTION_SUGGESTIONS = [
  "Entradas",
  "Platos fuertes",
  "Bebidas",
  "Postres",
  "Desayunos",
  "Ensaladas",
  "Sopas",
  "Combos / Paquetes",
] as const;

const CUSTOM_SECTION = "__custom__";

export function MenuSectionForm({
  open,
  section,
  saving = false,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");
  const [displayOrder, setDisplayOrder] =
    useState("0");
  const [isActive, setIsActive] =
    useState(true);
  const [selectedOption, setSelectedOption] =
    useState<string>("");
  const [error, setError] = useState<
    string | null
  >(null);

  const isEditing = Boolean(section);

  useEffect(() => {
    if (!open) return;

    const sectionName = section?.name ?? "";

    setName(sectionName);
    setDescription(section?.description ?? "");
    setDisplayOrder(
      String(section?.display_order ?? 0),
    );
    setIsActive(section?.is_active ?? true);
    setError(null);

    if (section) {
      const matchingSuggestion =
        SECTION_SUGGESTIONS.find(
          (suggestion) =>
            suggestion.toLowerCase() ===
            sectionName.trim().toLowerCase(),
        );

      setSelectedOption(
        matchingSuggestion ?? CUSTOM_SECTION,
      );
    } else {
      setSelectedOption("");
    }
  }, [open, section]);

  if (!open) return null;

  function selectSuggestion(
    suggestion: string,
  ) {
    setSelectedOption(suggestion);
    setName(suggestion);
    setError(null);
  }

  function selectCustom() {
    setSelectedOption(CUSTOM_SECTION);

    if (
      SECTION_SUGGESTIONS.some(
        (suggestion) =>
          suggestion.toLowerCase() ===
          name.trim().toLowerCase(),
      )
    ) {
      setName("");
    }

    setError(null);
  }

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setError(
        isEditing
          ? "Escribe el nombre de la sección."
          : "Selecciona una sección o escribe un nombre personalizado.",
      );
      return;
    }

    await onSubmit({
      name: cleanName,
      description:
        description.trim() || null,
      is_active: isActive,
      display_order: Math.max(
        0,
        Number(displayOrder) || 0,
      ),
    });
  };

  return (
    <div className="fixed inset-0 z-[20000] overflow-y-auto bg-black/40 p-4 sm:p-6">
      <form
        onSubmit={submit}
        className="mx-auto my-4 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:my-8 sm:p-6"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">
              Sección
            </p>

            <h2 className="mt-0.5 text-2xl font-bold text-gray-900">
              {isEditing
                ? "Editar sección"
                : "Nueva sección"}
            </h2>

            {!isEditing ? (
              <p className="mt-1 text-sm text-gray-500">
                Elige el tipo de sección que quieres
                agregar a tu menú.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={21} />
          </button>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-5">
          {!isEditing ? (
            <div>
              <span className="mb-3 block text-sm font-semibold text-gray-700">
                Selecciona una sección *
              </span>

              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_SUGGESTIONS.map(
                  (suggestion) => {
                    const selected =
                      selectedOption ===
                      suggestion;

                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          selectSuggestion(
                            suggestion,
                          )
                        }
                        className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-[#168e00] bg-[#168e00]/[0.07] text-[#004e28] shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:border-[#168e00]/40 hover:bg-[#168e00]/[0.03]"
                        }`}
                      >
                        <span className="font-semibold">
                          {suggestion}
                        </span>

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
                  },
                )}
              </div>

              <button
                type="button"
                onClick={selectCustom}
                className={`mt-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  selectedOption ===
                  CUSTOM_SECTION
                    ? "border-[#168e00] bg-[#168e00]/[0.07] text-[#004e28]"
                    : "border-dashed border-gray-300 text-gray-600 hover:border-[#168e00]/50 hover:bg-[#168e00]/[0.03]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    selectedOption ===
                    CUSTOM_SECTION
                      ? "bg-[#168e00] text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Plus size={18} />
                </span>

                <span>
                  <span className="block font-semibold">
                    Otra sección
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Escribe un nombre diferente
                  </span>
                </span>
              </button>

              {selectedOption ===
              CUSTOM_SECTION ? (
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Nombre de la sección *
                  </span>

                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => {
                      setName(
                        event.target.value,
                      );
                      setError(null);
                    }}
                    maxLength={100}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                    placeholder="Ej. Especialidades de la casa"
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Nombre *
              </span>

              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                maxLength={100}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                placeholder="Ej. Platos fuertes"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Descripción
              <span className="ml-1 font-normal text-gray-400">
                (opcional)
              </span>
            </span>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
              placeholder="Ej. Nuestros platillos principales preparados al momento."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Orden
              </span>

              <input
                type="number"
                min="0"
                value={displayOrder}
                onChange={(event) =>
                  setDisplayOrder(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
              />

              <span className="mt-1.5 block text-xs leading-5 text-gray-400">
                0 aparece primero, después 1,
                2, 3...
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 self-start rounded-2xl border border-gray-200 p-4 transition hover:border-[#168e00]/30">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(
                    event.target.checked,
                  )
                }
                className="h-5 w-5 shrink-0 accent-[#168e00]"
              />

              <span>
                <span className="block font-semibold text-gray-800">
                  Sección activa
                </span>

                <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                  Se mostrará en el menú.
                </span>
              </span>
            </label>
          </div>

          {!isEditing &&
          selectedOption &&
          selectedOption !==
            CUSTOM_SECTION ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#168e00]/15 bg-[#168e00]/[0.05] px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#168e00] text-white">
                <Check size={16} />
              </span>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Sección seleccionada
                </p>

                <p className="font-semibold text-[#004e28]">
                  {name}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              (!isEditing &&
                !selectedOption)
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white transition hover:bg-[#117500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : null}

            {saving
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Crear sección"}
          </button>
        </div>
      </form>
    </div>
  );
}