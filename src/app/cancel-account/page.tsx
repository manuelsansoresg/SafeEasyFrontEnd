"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { cancelDeletionByToken } from "@/services/accountDeletion";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  XCircle,
} from "lucide-react";

type Screen = "confirm" | "success" | "error" | "loading";

function CancelAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [screen, setScreen] = useState<Screen>(token ? "confirm" : "error");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    setErrorMessage(null);
    try {
      const result = await cancelDeletionByToken(token);

      if (result.error_code === "INVALID_OR_EXPIRED_DELETION_TOKEN") {
        setErrorMessage(
          result.message ||
            "Este enlace ya no es válido. Puede haber expirado, haber sido utilizado anteriormente o el proceso de eliminación ya pudo haber comenzado.",
        );
        setScreen("error");
        return;
      }

      if (result.error_code) {
        setErrorMessage(result.message || "No se pudo cancelar la eliminación.");
        setScreen("error");
        return;
      }

      setScreen("success");
      // Clean token from URL
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, "/cancel-account");
      }
    } catch {
      setErrorMessage("Error de conexión. Intenta nuevamente.");
      setScreen("error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && screen === "confirm") {
    setScreen("error");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src="/logo-drooopy.svg"
              alt="Drooopy"
              width={160}
              height={48}
              className="h-auto w-40"
              priority
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
          {screen === "confirm" && (
            <>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Cancelar eliminación de cuenta
                </h2>
                <p className="text-sm text-gray-500">
                  Tu cuenta está programada para eliminación.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    ¿Deseas cancelar este proceso? Tu cuenta volverá a estar disponible inmediatamente.
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Volver a Drooopy
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    "Cancelar eliminación"
                  )}
                </button>
              </div>
            </>
          )}

          {screen === "success" && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-green-50 rounded-full mx-auto">
                  <CheckCircle size={28} className="text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Eliminación cancelada
                </h2>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm text-green-800">
                    <p className="font-medium">Tu cuenta vuelve a estar disponible.</p>
                    <p className="text-green-700">
                      Por seguridad, tus sesiones anteriores permanecen cerradas. Puedes iniciar sesión nuevamente.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                <LogIn size={18} />
                Iniciar sesión
              </button>
            </>
          )}

          {screen === "error" && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 rounded-full mx-auto">
                  <XCircle size={28} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Enlace no válido
                </h2>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">
                    {errorMessage ||
                      "Este enlace ya no es válido. Puede haber expirado, haber sido utilizado anteriormente o el proceso de eliminación ya pudo haber comenzado."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                Volver a Drooopy
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CancelAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      }
    >
      <CancelAccountContent />
    </Suspense>
  );
}
