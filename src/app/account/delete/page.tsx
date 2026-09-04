"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";

export default function PublicAccountDeletePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (hasHydrated && token) {
      router.replace("/account/delete/confirm");
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || token) {
    return (
      <div className="min-h-screen bg-[#f2f3f4] px-4 pt-32 pb-12 sm:px-6">
        <p role="status" className="mx-auto max-w-2xl text-sm text-gray-500">
          {hasHydrated ? "Redirigiendo..." : "Verificando tu sesión..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f4] px-4 pt-32 pb-12 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Trash2 size={22} className="text-red-500" aria-hidden="true" />
          </div>
          <h1
            className="text-2xl font-bold text-[#004e28] sm:text-3xl"
            style={{ fontFamily: "var(--font-varela-round)" }}
          >
            Eliminar cuenta de Drooopy
          </h1>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-black sm:text-base">
          <p>
            Puedes solicitar la eliminación de tu cuenta de Drooopy y de tus datos
            asociados.
          </p>
          <p>
            Por seguridad, debes iniciar sesión para identificar tu cuenta. Después
            podrás revisar la información y confirmar tu solicitud de eliminación.
          </p>
          <p>
            La eliminación será permanente después del periodo de gracia. Mientras
            la solicitud siga pendiente y el proceso no haya comenzado, podrás
            cancelarla desde el correo que recibirás.
          </p>
          <p>
            Si tienes operaciones activas que puedan afectar a otras personas, la
            eliminación puede quedar impedida temporalmente hasta que esas
            obligaciones hayan finalizado.
          </p>
        </div>

        <Link
          href="/login?redirect=/account/delete/confirm"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#168e00] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#004e28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] sm:w-auto"
        >
          Iniciar sesión para eliminar mi cuenta
        </Link>
      </section>
    </div>
  );
}
