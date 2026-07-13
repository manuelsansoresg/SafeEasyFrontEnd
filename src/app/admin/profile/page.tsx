"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { startMercadoPagoConnect } from "@/lib/mercadoPagoConnect";
import { PageHero } from "@/components/ui/PageHero";
import { Loader2, CheckCircle, Eye, EyeOff, User, Mail, Lock, Shield, CreditCard, Unlink } from "lucide-react";

type NormalizedMpAccount = {
  connected: boolean;
  email: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(rec: Record<string, unknown> | null, key: string) {
  return rec && typeof rec[key] === "string" ? rec[key] : null;
}

function getBool(rec: Record<string, unknown> | null, key: string) {
  return rec && typeof rec[key] === "boolean" ? rec[key] : null;
}

function normalizeMpAccount(payload: unknown): NormalizedMpAccount | null {
  const normalizeFromRecord = (rec: Record<string, unknown>): NormalizedMpAccount | null => {
    const direct =
      getBool(rec, "connected") ??
      getBool(rec, "is_connected") ??
      getBool(rec, "isLinked") ??
      getBool(rec, "is_linked") ??
      getBool(rec, "linked") ??
      getBool(rec, "mp_is_linked") ??
      getBool(rec, "mpIsLinked");

    let connected = direct;
    if (connected == null) {
      const status = getString(rec, "status") || getString(rec, "state") || getString(rec, "connection_status");
      if (status) {
        const key = status.toLowerCase();
        if (["connected", "linked", "active", "ok"].includes(key)) connected = true;
        if (["disconnected", "unlinked", "inactive"].includes(key)) connected = false;
      }
    }
    if (connected == null) {
      connected = typeof rec.access_token === "string" || typeof rec.token === "string" || typeof rec.refresh_token === "string";
    }

    const account = isRecord(rec.account) ? rec.account : null;
    const email =
      getString(rec, "email") ||
      getString(rec, "account_email") ||
      getString(rec, "payer_email") ||
      getString(rec, "connected_email") ||
      getString(rec, "mp_email") ||
      getString(rec, "mp_connected_email") ||
      getString(account, "email");

    return { connected, email };
  };

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (!isRecord(entry)) continue;
      const provider = (getString(entry, "provider") || getString(entry, "platform") || getString(entry, "name") || "").toLowerCase();
      const accountType = (getString(entry, "account_type") || getString(entry, "type") || "").toLowerCase();
      if (provider && !provider.includes("mercado")) continue;
      if (accountType && !["seller", "vendedor", "vendor"].includes(accountType)) continue;
      return normalizeFromRecord(entry);
    }
    return null;
  }

  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.payment_accounts)) return normalizeMpAccount(payload.payment_accounts);
  if (Array.isArray(payload.accounts)) return normalizeMpAccount(payload.accounts);
  return normalizeFromRecord(payload);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function getResponseDetail(payload: unknown) {
  if (!isRecord(payload)) return null;
  return typeof payload.detail === "string" ? payload.detail : null;
}

export default function ProfilePage() {
  const { user, token } = useAuthStore();
  const isSeller = String(user?.role || "").toLowerCase() === "seller";
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mpStatusLoading, setMpStatusLoading] = useState(false);
  const [mpConnectLoading, setMpConnectLoading] = useState(false);
  const [mpDisconnectLoading, setMpDisconnectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mpAccount, setMpAccount] = useState<NormalizedMpAccount>({ connected: false, email: null });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !token) return;

      setLoading(true);
      setError(null);

      try {
        // Test both APIs as requested to see which one works best
        if (process.env.NODE_ENV === "development") console.log("Testing profile APIs...");
        
        const [resMe, resId] = await Promise.allSettled([
          fetchWithAuth('/api/users/me'),
          fetchWithAuth(`/api/users/${user.id}`)
        ]);

        let profileData: Record<string, unknown> | null = null;
        let usedSource = "";

        // Check /api/users/me
        if (resMe.status === 'fulfilled' && resMe.value.ok) {
            const data: unknown = await resMe.value.json();
            if (process.env.NODE_ENV === "development") console.log("/api/users/me response:", data);
            if (isRecord(data) && (data.email || data.name)) {
                profileData = data;
                usedSource = "/api/users/me";
            }
        }

        // Check /api/users/{id} if me didn't yield good data or just to compare
        if (resId.status === 'fulfilled' && resId.value.ok) {
            const data: unknown = await resId.value.json();
            if (process.env.NODE_ENV === "development") console.log(`/api/users/${user.id} response:`, data);
            
            // If we haven't found data yet, or if this one seems more complete (e.g. has name where other didn't)
            if (isRecord(data) && (!profileData || (!profileData.name && data.name))) {
                profileData = data;
                usedSource = `/api/users/${user.id}`;
            }
        }

        if (profileData) {
            if (process.env.NODE_ENV === "development") console.log(`Using data from ${usedSource}:`, profileData);
            setFormData(prev => ({
                ...prev,
                name: String(profileData.full_name || profileData.name || ""),
                email: String(profileData.email || "")
            }));
        } else {
            setError("No se pudieron cargar los datos del perfil. Intente recargar.");
            console.error("Both APIs failed to return usable profile data");
        }

      } catch (err: unknown) {
        console.error("Error fetching profile:", err);
        setError(getErrorMessage(err, "Error al cargar perfil"));
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, token]);

  const loadMercadoPagoAccount = useCallback(async () => {
    if (!isSeller || !token) return;

    setMpStatusLoading(true);
    try {
      const candidates = [
        "/api/mercadopago/account?account_type=seller",
        "/api/mercadopago/status?account_type=seller",
        "/api/mercadopago/account-status?account_type=seller",
      ];

      for (const url of candidates) {
        const res = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const normalized = normalizeMpAccount(data);
          if (normalized) {
            setMpAccount(normalized);
            return;
          }
        } else if (res.status !== 404) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Error ${res.status}`);
        }
      }

      const meRes = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
      if (!meRes.ok) {
        setMpAccount({ connected: false, email: null });
        return;
      }

      const meData = await meRes.json().catch(() => null);
      setMpAccount(normalizeMpAccount(meData) ?? { connected: false, email: null });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo validar la vinculación de Mercado Pago."));
    } finally {
      setMpStatusLoading(false);
    }
  }, [isSeller, token]);

  useEffect(() => {
    if (!isSeller || !token) return;

    loadMercadoPagoAccount();
    const onFocus = () => loadMercadoPagoAccount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadMercadoPagoAccount();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isSeller, loadMercadoPagoAccount, token]);

  useEffect(() => {
    if (!isSeller || !token || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") !== "callback" || params.get("mp_account_type") !== "seller") return;

    setSuccessMessage("Regresaste de Mercado Pago. Estamos validando la vinculación.");
    let attempts = 0;
    loadMercadoPagoAccount();
    const interval = window.setInterval(() => {
      attempts += 1;
      loadMercadoPagoAccount();
      if (attempts >= 10) window.clearInterval(interval);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isSeller, loadMercadoPagoAccount, token]);

  useEffect(() => {
    if (!mpAccount.connected || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") !== "callback") return;
    setSuccessMessage("Cuenta de Mercado Pago vinculada correctamente.");
  }, [mpAccount.connected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSuccessMessage(null);

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: { name: string; email: string; password?: string } = {
        name: formData.name,
        email: formData.email,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => ({}));
        throw new Error(getResponseDetail(errorData) || `Error al actualizar perfil (${response.status})`);
      }

      const updatedUser = await response.json();
      if (process.env.NODE_ENV === "development") console.log("Profile updated:", updatedUser);
      
      setSuccessMessage("Perfil actualizado correctamente");
      
      // Update store user data if needed (though store usually persists login data)
      // Note: We might want to update the global auth store state here if the name changed
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        password: "",
        confirmPassword: ""
      }));

    } catch (err: unknown) {
      console.error("Update error:", err);
      setError(getErrorMessage(err, "Error al guardar los cambios"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMercadoPagoConnect = async () => {
    if (!isSeller) return;
    setError(null);
    setSuccessMessage(null);
    setMpConnectLoading(true);
    try {
      await startMercadoPagoConnect("seller", { requireAuthenticatedStart: true });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo iniciar la vinculación con Mercado Pago."));
      setMpConnectLoading(false);
    }
  };

  const handleMercadoPagoDisconnect = async () => {
    if (!isSeller) return;

    setError(null);
    setSuccessMessage(null);
    setMpDisconnectLoading(true);

    try {
      const res = await fetchWithAuth("/api/mercadopago/disconnect?account_type=seller", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error ${res.status}`);
      }

      setSuccessMessage("Cuenta de Mercado Pago desvinculada correctamente.");
      await loadMercadoPagoAccount();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo desvincular la cuenta de Mercado Pago."));
    } finally {
      setMpDisconnectLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 font-[family-name:var(--font-poppins)]">
      <PageHero title="Mi Perfil" subtitle="Administra tu información personal y de acceso." />

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
            <Shield size={20} />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-xl border border-green-100 flex items-center gap-2">
            <CheckCircle size={20} />
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Información Básica</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                Nombre Completo
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Seguridad</h2>
            <p className="text-sm text-gray-500">Deja los campos de contraseña vacíos si no deseas cambiarla.</p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          {isSeller && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <h2 className="text-lg font-semibold text-gray-700">Mercado Pago</h2>
                {mpStatusLoading && (
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Loader2 size={14} className="animate-spin" />
                    Validando
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-[#f2f3f4] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                      <CreditCard size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">
                        {mpAccount.connected ? "Cuenta vinculada" : "Vincula tu cuenta de cobro"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {mpAccount.connected
                          ? mpAccount.email || "Mercado Pago está listo para recibir pagos."
                          : "Conecta Mercado Pago para que tus cobros como vendedor queden asociados a tu cuenta."}
                      </p>
                    </div>
                  </div>

                  {mpAccount.connected ? (
                    <button
                      type="button"
                      onClick={handleMercadoPagoDisconnect}
                      disabled={mpDisconnectLoading || mpStatusLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mpDisconnectLoading ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
                      {mpDisconnectLoading ? "Desvinculando..." : "Desvincular"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMercadoPagoConnect}
                      disabled={mpConnectLoading || mpStatusLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#008dcc] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mpConnectLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {mpConnectLoading ? "Redirigiendo..." : "Vincular Mercado Pago"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
