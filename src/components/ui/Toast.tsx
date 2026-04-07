"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; onClick: () => void };

export function Toast({
  type,
  message,
  action,
  onClose,
  className,
}: {
  type: ToastType;
  message: string;
  action?: ToastAction;
  onClose: () => void;
  className?: string;
}) {
  const dotClass =
    type === "success" ? "bg-[#168e00]" : type === "error" ? "bg-red-500" : "bg-blue-500";
  const borderClass =
    type === "success" ? "border-[#168e00]/20" : type === "error" ? "border-red-200" : "border-blue-200";
  const actionClass =
    type === "success"
      ? "text-[#168e00] hover:underline"
      : type === "error"
        ? "text-red-600 hover:underline"
        : "text-blue-600 hover:underline";

  return (
    <div className={cn("fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[80]", className)}>
      <div
        className={cn("rounded-2xl shadow-2xl border p-4 bg-white flex items-start gap-3", borderClass)}
        role="status"
        aria-live="polite"
      >
        <div className={cn("mt-1 w-2.5 h-2.5 rounded-full shrink-0", dotClass)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{message}</p>
          {action ? (
            <div className="mt-2">
              {action.kind === "link" ? (
                <Link
                  href={action.href}
                  className={cn("inline-flex items-center gap-2 text-sm font-semibold", actionClass)}
                  onClick={onClose}
                >
                  {action.label}
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    action.onClick();
                    onClose();
                  }}
                  className={cn("inline-flex items-center gap-2 text-sm font-semibold", actionClass)}
                >
                  {action.label}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

