"use client";

import { AlertCircle } from "lucide-react";

export function ModuleAccessError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-5xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <div className="flex items-center gap-3"><AlertCircle aria-hidden="true" /><p>No pudimos verificar el acceso al módulo.</p></div>
      <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-[#004e28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#168e00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">Reintentar</button>
    </div>
  );
}
