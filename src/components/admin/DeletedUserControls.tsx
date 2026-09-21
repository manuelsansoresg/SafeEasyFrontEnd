"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

interface DeletedUserControlsProps {
  /** ISO timestamp of when the user was soft-deleted, or null if not deleted. */
  deletedAt: string | null | undefined;
  /** Whether the user is also `is_active` (independent of the soft-delete flag). */
  isActive?: boolean;
  /** Called when the user clicks the trash icon to soft-delete the user. */
  onDelete: () => void;
  /** Called when the user clicks the restore icon. */
  onRestore: () => void;
  /** Disable both action buttons (e.g. while a request is in flight). */
  disabled?: boolean;
}

const formatDeletedAt = (iso: string) => {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
};

export function DeletedBadge({ deletedAt }: { deletedAt: string | null | undefined }) {
  if (!deletedAt) return null;
  const formatted = formatDeletedAt(deletedAt);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
      title={formatted ? `Eliminado el ${formatted}` : "Usuario eliminado"}
    >
      <Trash2 size={12} />
      Eliminado{formatted ? ` · ${formatted}` : ""}
    </span>
  );
}

export function DeletedUserControls({
  deletedAt,
  isActive,
  onDelete,
  onRestore,
  disabled = false,
}: DeletedUserControlsProps) {
  const [pending, setPending] = useState(false);
  const handle = (fn: () => void | Promise<void>) => async () => {
    if (pending || disabled) return;
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  };

  if (deletedAt) {
    return (
      <button
        type="button"
        onClick={handle(onRestore)}
        disabled={pending || disabled}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Restaurar usuario"
      >
        <RotateCcw size={14} />
        Restaurar
      </button>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      {isActive === false ? (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Inactivo
        </span>
      ) : null}
      <button
        type="button"
        onClick={handle(onDelete)}
        disabled={pending || disabled}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        title="Eliminar usuario"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
