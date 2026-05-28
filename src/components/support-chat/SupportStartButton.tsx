"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Loader2, Mail, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { supportChatService } from "@/services/supportChatService";

interface SupportStartButtonProps {
  className?: string;
  label?: string;
  variant?: "primary" | "link";
}

export function SupportStartButton({
  className,
  label = "Escribir a soporte",
  variant = "primary",
}: SupportStartButtonProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const role = String(user?.role || "").toLowerCase();
    if (role === "admin" || role === "superuser") {
      router.push("/admin/support");
      return;
    }

    setError(null);
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = subject.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const conversation = await supportChatService.createConversation(trimmed);
      setOpen(false);
      setSubject("");
      router.push(`/support/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el chat de soporte.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={cn(
          variant === "link"
            ? "mt-6 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition hover:text-primary"
            : "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary",
          className
        )}
      >
        {variant === "link" ? <LifeBuoy size={16} /> : <Mail size={18} />}
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-[family-name:var(--font-varela-round)] text-sm text-secondary">Soporte Drooopy</p>
                <h2 className="mt-1 text-2xl font-bold text-primary">Iniciar chat de soporte</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Escribe el asunto y abriremos una conversación directa con el equipo de soporte.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-[#f2f3f4] hover:text-primary"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-gray-900" htmlFor="support-start-subject">
                Asunto
              </label>
              <input
                id="support-start-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ej. Tengo un problema con un producto"
                className="h-12 w-full rounded-full border border-gray-200 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/10"
                maxLength={160}
                autoFocus
                required
              />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !subject.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
                  Iniciar chat
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
