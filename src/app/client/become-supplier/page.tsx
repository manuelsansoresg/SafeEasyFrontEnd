"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  ReceiptText,
  ShieldCheck,
  Store,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { normalizePlanFeatures } from "@/components/sell/planText";
import { fetchWithAuth } from "@/lib/api";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { subscriptionsService } from "@/services/subscriptionsService";
import { useAuthStore } from "@/store/useAuthStore";
import type { Plan } from "@/types/subscriptions";

type SupplierPayload = {
  id?: number;
  name?: string;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const buildSlug = (value: string) => {
  const slug = normalize(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "empresa";
};

const cleanInput = (value: string) =>
  value
    .trim()
    .slice(0, 255)
    .replace(/[<>]/g, "");

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const getPlanPeriod = (duration: Plan["duration"]) => (duration === "monthly" ? "mes" : "año");

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const extractMessage = (body: unknown, fallback: string): string => {
  if (!body) return fallback;
  if (typeof body === "string") return body;
  if (Array.isArray(body)) {
    const messages = body.map((item) => extractMessage(item, "")).filter(Boolean);
    return messages.length ? messages.join(", ") : fallback;
  }
  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.error;
    if (typeof detail === "string") return detail;
    if (detail) return extractMessage(detail, fallback);
  }
  return fallback;
};

const translateMessage = (message: string, fallback: string) => {
  const lower = message.toLowerCase();
  if (!message.trim()) return fallback;
  if (lower.includes("supplier") && lower.includes("name")) {
    return "Ya existe una empresa registrada con ese nombre. Usa otro nombre para continuar.";
  }
  if (lower.includes("already exists") || lower.includes("duplicate") || lower.includes("unique")) {
    return "Ya existe una empresa registrada con ese nombre. Usa otro nombre para continuar.";
  }
  if (lower.includes("only suppliers")) {
    return "Tu cuenta debe activarse como proveedor antes de generar el pago. Intenta nuevamente.";
  }
  if (lower.includes("plan not found")) return "No encontramos el paquete seleccionado.";
  if (lower.includes("plan is not active")) return "El paquete seleccionado no está activo.";
  return message;
};

const buildSupplierFormData = (userId: number, companyName: string, email: string) => {
  const data = new FormData();
  const append = (key: string, value: string) => data.append(key, value.trim());

  append("name", companyName);
  data.append("short_name", buildSlug(companyName));
  append("rfc", "");
  append("phone", "");
  append("email", email);
  append("city", "");
  append("state", "");
  append("country", "Mexico");
  append("short_description", "");
  append("description", "");
  append("address", "");
  append("exterior_number", "");
  append("interior_number", "");
  append("neighborhood", "");
  append("zip_code", "");
  append("cp", "");
  append("cross_street_1", "");
  append("cross_street_2", "");
  append("about", "");
  data.append("user_id", String(userId));
  data.append("is_active", "true");
  data.append("transfer_accepted", "false");
  data.append("accepts_delivery", "false");
  data.append("accepts_pickup", "true");
  data.append("accepts_courier", "false");

  return data;
};

export default function BecomeSupplierPage() {
  const router = useRouter();
  const { user, token, refreshToken, login } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingCompany, setCheckingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "supplier") {
      router.replace("/admin/dashboard");
    }
  }, [router, user?.role]);

  useEffect(() => {
    let mounted = true;

    subscriptionsService
      .listPlans()
      .then((items) => {
        if (!mounted) return;
        const activePlans = items.filter((plan) => plan.is_active);
        setPlans(activePlans);
        setSelectedPlanId((current) => current ?? activePlans[0]?.id ?? null);
      })
      .catch(() => {
        if (mounted) setError("No pudimos cargar los paquetes disponibles.");
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId]
  );

  const checkCompanyNameAvailability = async (name: string) => {
    setCheckingCompany(true);
    setCompanyError(null);
    try {
      const response = await fetchWithAuth(`/api/suppliers/check-name?name=${encodeURIComponent(name)}`);
      const body = await readResponseBody(response);

      if (response.status === 404 || response.status === 405) return;

      if (!response.ok) {
        const message = extractMessage(body, "No pudimos validar si la empresa ya existe.");
        throw new Error(translateMessage(message, "No pudimos validar si la empresa ya existe."));
      }

      if (body && typeof body === "object" && Boolean((body as Record<string, unknown>).exists)) {
        throw new Error("Ya existe una empresa registrada con ese nombre. Usa otro nombre para continuar.");
      }
    } finally {
      setCheckingCompany(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCompanyError(null);

    const cleanCompanyName = cleanInput(companyName);

    if (!user || !token) {
      setError("Necesitas iniciar sesión para activar tu empresa.");
      return;
    }

    if (!selectedPlan) {
      setError("Selecciona un paquete para continuar.");
      return;
    }

    if (!cleanCompanyName) {
      setCompanyError("Ingresa el nombre de tu empresa.");
      return;
    }

    if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.\-]+$/.test(cleanCompanyName)) {
      setCompanyError("El nombre de la empresa solo puede usar letras, números, espacios, puntos y guiones.");
      return;
    }

    setSubmitting(true);

    try {
      await checkCompanyNameAvailability(cleanCompanyName);

      const updateUserResponse = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          role: "supplier",
          is_active: true,
        }),
      });
      const updateUserBody = await readResponseBody(updateUserResponse);

      if (!updateUserResponse.ok) {
        const message = extractMessage(updateUserBody, "No pudimos activar tu cuenta como proveedor.");
        throw new Error(translateMessage(message, "No pudimos activar tu cuenta como proveedor."));
      }

      login(token, refreshToken, {
        ...user,
        role: "supplier",
      });

      const supplierResponse = await fetchWithAuth("/api/suppliers/", {
        method: "POST",
        body: buildSupplierFormData(user.id, cleanCompanyName, user.email),
      });
      const supplierBody = await readResponseBody(supplierResponse);

      if (!supplierResponse.ok) {
        const message = extractMessage(supplierBody, "Tu cuenta se activó, pero no pudimos registrar tu empresa.");
        throw new Error(translateMessage(message, "Tu cuenta se activó, pero no pudimos registrar tu empresa."));
      }

      const supplier = supplierBody && typeof supplierBody === "object" ? (supplierBody as SupplierPayload) : {};
      const supplierId = Number(supplier.id);

      const purchase = await subscriptionsService.purchase(
        selectedPlan.id,
        undefined,
        Number.isFinite(supplierId) ? supplierId : undefined
      );

      const safeInitPoint = getSafeMercadoPagoUrl(purchase.init_point);
      if (!safeInitPoint) {
        throw new Error("Mercado Pago no devolvió una liga de pago.");
      }

      window.location.href = safeInitPoint;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "No pudimos iniciar el pago. Intenta nuevamente.";

      if (message.toLowerCase().includes("empresa") || message.toLowerCase().includes("supplier")) {
        setCompanyError(message);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-[family-name:var(--font-poppins)]">
      <PageHero title="Volverme proveedor" subtitle="Activa tu empresa con la cuenta que ya tienes registrada." />

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">Paso 1</p>
              <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
                Elige tu paquete
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Estos son los paquetes activos para crear tu perfil de proveedor.
              </p>
            </div>
            <ReceiptText className="hidden text-primary md:block" size={28} />
          </div>

          {loadingPlans ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-gray-500">
              <Loader2 className="animate-spin text-primary" size={26} />
              Cargando paquetes...
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl bg-[#f2f3f4] p-5 text-sm text-gray-600">No hay paquetes activos disponibles.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {plans.map((plan, index) => {
                const active = plan.id === selectedPlan?.id;
                const features = normalizePlanFeatures(plan.features, plan.description).slice(0, 5);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative flex min-h-[360px] flex-col rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-2 ring-primary/10"
                        : "border-gray-100 bg-white hover:border-primary/30 hover:bg-[#f2f3f4]"
                    }`}
                  >
                    {index === 1 ? (
                      <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase text-white">
                        Recomendado
                      </span>
                    ) : null}
                    <div className="mb-5 pr-28">
                      <h3 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
                        {plan.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-gray-500">{plan.description || "Paquete disponible"}</p>
                    </div>

                    <div className="mb-6">
                      <span className="text-4xl font-bold text-gray-950">{formatCurrency(plan.price)}</span>
                      <span className="ml-1 text-sm text-gray-500">/{getPlanPeriod(plan.duration)}</span>
                    </div>

                    <ul className="mt-auto space-y-3">
                      {(features.length > 0 ? features : ["Perfil verificado"]).map((feature, featureIndex) => (
                        <li key={`${plan.id}-${featureIndex}`} className="flex items-start gap-3 text-sm text-gray-600">
                          <Check className="mt-0.5 shrink-0 text-[#168e00]" size={18} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary">
                      {active ? "Paquete seleccionado" : "Seleccionar paquete"}
                      {active ? <CheckCircle2 size={20} /> : <ArrowRight size={18} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6 xl:sticky xl:top-32">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store size={22} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paso 2</p>
                <h2 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-950">
                  Registra tu empresa
                </h2>
              </div>
            </div>

            {selectedPlan ? (
              <div className="mb-5 rounded-xl bg-[#f2f3f4] p-4">
                <p className="text-sm text-gray-500">Total a pagar</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-3xl font-bold text-primary">{formatCurrency(selectedPlan.price)}</span>
                  <span className="pb-1 text-sm text-gray-500">/{getPlanPeriod(selectedPlan.duration)}</span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700">
                Nombre de la empresa
              </label>
              <input
                id="companyName"
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  setCompanyError(null);
                }}
                maxLength={255}
                required
                className={`h-12 w-full rounded-lg border px-4 text-gray-900 outline-none transition focus:ring-4 ${
                  companyError
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-gray-200 focus:border-primary focus:ring-primary/10"
                }`}
                placeholder="Mi Negocio S.A."
                aria-describedby={companyError ? "companyName-error" : undefined}
              />
              {companyError ? (
                <p id="companyName-error" className="text-xs leading-5 text-red-600" role="alert">
                  {companyError}
                </p>
              ) : (
                <p className="text-xs leading-5 text-gray-500">
                  Validaremos que el nombre no esté repetido antes de crear tu proveedor.
                </p>
              )}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-gray-100 p-4 text-sm leading-6 text-gray-500">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} />
              Se usará tu usuario actual para vincular la empresa. No tendrás que iniciar sesión de nuevo.
            </div>

            <button
              type="submit"
              disabled={submitting || checkingCompany || loadingPlans || !selectedPlan}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 font-bold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              aria-busy={submitting || checkingCompany}
            >
              {checkingCompany ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Validando empresa...
                </>
              ) : submitting ? (
                <>
                  <CreditCard size={20} />
                  Preparando pago...
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  Pagar y activar
                </>
              )}
            </button>
          </section>
        </aside>
      </form>
    </div>
  );
}
