"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { requestAccountDeletion } from "@/services/accountDeletion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { DeletionObligation } from "@/types/account-deletion";

type Screen = "info" | "confirm" | "success" | "obligations" | "already_requested";

/* ─── Steps for the "¿Qué sucede después?" section ─── */
const steps = [
  {
    num: 1,
    title: "Se bloquea tu cuenta",
    desc: "Tus sesiones se cierran y dejas de tener acceso al sistema.",
    icon: Lock,
  },
  {
    num: 2,
    title: "Se programa la eliminación",
    desc: "Tu solicitud queda pendiente durante el periodo de gracia antes de la eliminación permanente.",
    icon: Clock,
  },
  {
    num: 3,
    title: "Puedes cambiar de opinión",
    desc: "Mientras el proceso no haya comenzado, podrás cancelarlo desde el correo.",
    icon: ShieldCheck,
  },
];

/* ─── Warning bullets ─── */
const warningBullets = [
  "Tu cuenta será bloqueada al aceptar la solicitud.",
  "Todas tus sesiones activas se cerrarán.",
  "Se programará la eliminación permanente de tus datos.",
  "Recibirás un correo desde el cual podrás cancelar mientras la solicitud siga pendiente.",
];

export default function AccountDeletePage() {
  const router = useRouter();
  const { token, logout } = useAuthStore();
  const hasHydrated = useAuthHydrated();
  const [screen, setScreen] = useState<Screen>("info");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obligations, setObligations] = useState<DeletionObligation[]>([]);
  const [obligationMessage, setObligationMessage] = useState<string | null>(null);

  // Scroll to top when screen changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  const handleRequestDeletion = async () => {
    if (!useAuthStore.getState().token) {
      router.push("/login?redirect=/account/delete");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await requestAccountDeletion();

      if (result.error_code === "ACCOUNT_HAS_ACTIVE_OBLIGATIONS") {
        if (Array.isArray(result.obligations)) {
          setObligations(result.obligations);
        } else if (typeof result.obligations === "string") {
          setObligationMessage(result.obligations);
        } else {
          setObligationMessage(
            result.message ||
              "No puedes eliminar tu cuenta mientras tengas obligaciones activas.",
          );
        }
        setScreen("obligations");
        return;
      }

      if (
        result.error_code === "ACCOUNT_DELETION_ALREADY_REQUESTED" ||
        result.error_code === "ACCOUNT_PENDING_DELETION"
      ) {
        setScreen("already_requested");
        return;
      }

      if (result.error_code) {
        setError(result.message || "Ocurrió un error al procesar la solicitud.");
        return;
      }

      setScreen("success");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAndLogout = () => {
    logout();
    router.push("/login");
  };

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div role="status" className="text-gray-500">
          Verificando tu sesión...
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     INFO SCREEN
     ═══════════════════════════════════════════════════ */
  if (screen === "info" || !token) {
    return (
      <div className="max-w-[860px]">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* ── Card Header ── */}
          <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-50">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <div>
                <h1
                  className="text-xl sm:text-2xl font-bold text-gray-900"
                  style={{ fontFamily: "var(--font-varela-round)" }}
                >
                  Eliminar cuenta de Drooopy
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Solicita la eliminación permanente de tu cuenta de Drooopy y sus datos asociados.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-8">
            {/* ── Antes de continuar ── */}
            <section>
              <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Antes de continuar
              </h2>
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-5">
                <ul className="space-y-2">
                  {warningBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-amber-900">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── ¿Qué sucede después? ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                ¿Qué sucede después?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {steps.map((s) => (
                  <div
                    key={s.num}
                    className="relative bg-gray-50 border border-gray-100 rounded-xl p-5 flex flex-col items-center text-center"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm mb-3">
                      {s.num}
                    </div>
                    <s.icon size={20} className="text-gray-400 mb-2" />
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">{s.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Obligaciones activas (nota informativa) ── */}
            <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-3">
              <Info size={18} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600 leading-relaxed">
                Si tienes operaciones activas que puedan afectar a otras personas, Drooopy no
                permitirá iniciar la eliminación hasta que esas obligaciones hayan finalizado.
              </p>
            </section>

            {/* ── Error ── */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* ── Zona de acción destructiva ─ */}
            <section className="border-t border-gray-100 pt-8">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                Eliminar permanentemente mi cuenta
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Por seguridad, la solicitud requiere iniciar sesión para identificar tu cuenta.
                Una vez que el proceso definitivo haya finalizado, tu cuenta no podrá recuperarse.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!token) {
                      router.push("/login?redirect=/account/delete");
                      return;
                    }
                    setScreen("confirm");
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 px-6 rounded-xl text-sm font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 transition-all disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {token ? "Eliminar mi cuenta" : "Iniciar sesión para eliminar mi cuenta"}
                </button>
                <p className="text-xs text-gray-400">
                  Podrás cancelar la solicitud desde el correo recibido mientras el proceso no haya
                  comenzado.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     CONFIRM SCREEN (modal-like inside the card)
     ═══════════════════════════════════════════════════ */
  if (screen === "confirm") {
    return (
      <div className="max-w-[860px]">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-50">
                <ShieldCheck size={22} className="text-red-500" />
              </div>
              <div>
                <h2
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: "var(--font-varela-round)" }}
                >
                  Confirmar eliminación
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Último paso antes de solicitar la eliminación
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setScreen("info");
                setError(null);
              }}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Volver"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-6">
            {/* Warning */}
            <div className="bg-red-50/70 border border-red-100 rounded-xl p-5">
              <div className="flex gap-3">
                <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-red-800">
                    ¿Seguro que deseas eliminar tu cuenta?
                  </p>
                  <ul className="space-y-1">
                    {[
                      "Tu cuenta quedará bloqueada de inmediato.",
                      "Se cerrarán todas las sesiones activas.",
                      "Podrás cancelar durante el periodo de gracia.",
                      "Después del procesamiento definitivo no podrá recuperarse.",
                    ].map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setScreen("info");
                  setError(null);
                }}
                disabled={isLoading}
                className="py-2.5 px-6 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestDeletion}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 px-6 rounded-xl text-sm font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Confirmar eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     SUCCESS SCREEN
     ═══════════════════════════════════════════════════ */
  if (screen === "success") {
    return (
      <div className="max-w-[860px]">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-green-50">
                <CheckCircle size={22} className="text-green-500" />
              </div>
              <div>
                <h2
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: "var(--font-varela-round)" }}
                >
                  Solicitud aceptada
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Tu cuenta ha sido bloqueada</p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-6">
            <div className="bg-green-50/70 border border-green-100 rounded-xl p-5">
              <div className="flex gap-3">
                <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-800">
                    Tu solicitud de eliminación fue aceptada.
                  </p>
                  <p className="text-sm text-green-700">
                    Se ha enviado un correo con instrucciones para cancelar la eliminación si
                    cambias de opinión.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmAndLogout}
              className="py-2.5 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     ALREADY REQUESTED SCREEN (409)
     ═══════════════════════════════════════════════════ */
  if (screen === "already_requested") {
    return (
      <div className="max-w-[860px]">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-50">
                <Clock size={22} className="text-amber-500" />
              </div>
              <div>
                <h2
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: "var(--font-varela-round)" }}
                >
                  Solicitud ya existente
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Ya tienes una eliminación programada
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-6">
            <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-5">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Tu cuenta ya está programada para eliminación.
                  </p>
                  <p className="text-sm text-amber-700">
                    Ya habías solicitado la eliminación de tu cuenta previamente. Revisa tu correo
                    electrónico para encontrar el enlace de cancelación si deseas detener el
                    proceso.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmAndLogout}
              className="py-2.5 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     OBLIGATIONS SCREEN (400)
     ═══════════════════════════════════════════════════ */
  return (
    <div className="max-w-[860px]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-50">
              <AlertCircle size={22} className="text-amber-500" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-gray-900"
                style={{ fontFamily: "var(--font-varela-round)" }}
              >
                Obligaciones pendientes
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                No se puede eliminar la cuenta en este momento
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-8 space-y-6">
          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-5">
            <div className="flex gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-800">
                  No puedes eliminar tu cuenta mientras tengas obligaciones activas.
                </p>
                {obligationMessage && (
                  <p className="text-sm text-amber-700">{obligationMessage}</p>
                )}
              </div>
            </div>
          </div>

          {obligations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Operaciones pendientes:</h3>
              <div className="space-y-2">
                {obligations.map((obs, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 shrink-0">
                        {obs.type === "order" && (
                          <span className="text-xs font-bold text-gray-600">ORD</span>
                        )}
                        {obs.type === "refund" && (
                          <span className="text-xs font-bold text-gray-600">REF</span>
                        )}
                        {obs.type === "delivery" && (
                          <span className="text-xs font-bold text-gray-600">DEL</span>
                        )}
                        {!["order", "refund", "delivery"].includes(obs.type) && (
                          <span className="text-xs font-bold text-gray-600">?</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {typeof obs.description === "string"
                            ? obs.description
                            : `Obligación de tipo: ${obs.type}`}
                        </p>
                        {typeof obs.reference === "string" && obs.reference && (
                          <p className="text-xs text-gray-500 mt-1">
                            Referencia: {obs.reference}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/admin/dashboard")}
            className="py-2.5 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-colors"
          >
            Volver al panel
          </button>
        </div>
      </div>
    </div>
  );
}
