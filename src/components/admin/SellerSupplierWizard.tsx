"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { normalizePlanFeatures } from "@/components/sell/planText";
import { subscriptionsService } from "@/services/subscriptionsService";
import { useAuthStore } from "@/store/useAuthStore";
import type { PurchaseResponse } from "@/types/subscriptions";
import type { Plan } from "@/types/subscriptions";

type WizardStep = "plan" | "payment" | "supplier" | "done";
type PaymentMethod = "card" | "card_terminal";

type SupplierRegistrationForm = {
  name: string;
  lastName: string;
  secondLastName: string;
  email: string;
  companyName: string;
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string | null) => ({
  Authorization: `Bearer ${String(token || "").replace(/^bearer\s+/i, "").trim()}`,
});

const initialForm: SupplierRegistrationForm = {
  name: "",
  lastName: "",
  secondLastName: "",
  email: "",
  companyName: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

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

  return slug || "proveedor";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "No pudimos completar el registro. Intenta nuevamente.";
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {}

  return text;
};

const extractErrorMessage = (body: unknown, fallback: string): string => {
  if (!body) return fallback;
  if (typeof body === "string") return body;
  if (Array.isArray(body)) {
    const messages = body.map((item) => extractErrorMessage(item, "")).filter(Boolean);
    return messages.length ? messages.join(", ") : fallback;
  }
  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.error;
    if (typeof detail === "string") return detail;
    if (detail) return extractErrorMessage(detail, fallback);
  }
  return fallback;
};

const translateErrorMessage = (message: string, fallback: string) => {
  const lower = message.toLowerCase();
  if (!message.trim()) return fallback;
  if (lower.includes("already exists") || lower.includes("duplicate") || lower.includes("unique")) {
    if (lower.includes("email") || lower.includes("correo") || lower.includes("user")) {
      return "Ese correo ya está registrado. Usa otro correo para crear el proveedor.";
    }
    return "Ya existe un registro con esos datos. Revisa la información e intenta nuevamente.";
  }
  if (lower.includes("supplier") && lower.includes("name")) {
    return "Ya existe una empresa registrada con ese nombre. Usa otro nombre de empresa.";
  }
  return message;
};

const getPlanPeriod = (duration: Plan["duration"]) => (duration === "monthly" ? "mes" : "año");

const generatePassword = ({ name, lastName, secondLastName }: SupplierRegistrationForm) => {
  const clean = (value: string, fallback: string) => normalize(value).replace(/[^a-z0-9]/g, "").slice(0, 2) || fallback;
  const random = Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 5);
  return `${clean(name, "pr")}${clean(lastName, "us")}${clean(secondLastName, "mx")}${random}`.slice(0, 8);
};

const buildSupplierFormData = (userId: number, sellerId: number, form: SupplierRegistrationForm) => {
  const data = new FormData();
  const append = (key: string, value: string) => data.append(key, value.trim());

  append("name", form.companyName);
  data.append("short_name", buildSlug(form.companyName));
  append("email", form.email);
  data.append("country", "Mexico");
  data.append("is_active", "true");
  data.append("user_id", String(userId));
  data.append("registered_by_seller_id", String(sellerId));
  data.append("transfer_accepted", "false");
  data.append("accepts_delivery", "false");
  data.append("accepts_pickup", "true");

  return data;
};

const loginSupplierForPurchase = async (email: string, password: string) => {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const response = await fetch("/api/login/access-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = await readResponseBody(response);

  if (!response.ok || !payload || typeof payload !== "object" || typeof (payload as Record<string, unknown>).access_token !== "string") {
    const message = extractErrorMessage(payload, "No pudimos iniciar sesión como proveedor para activar la suscripción.");
    throw new Error(`Suscripción: ${message}`);
  }

  return String((payload as Record<string, unknown>).access_token);
};

const purchaseWithSupplierToken = async (supplierToken: string, planId: number, paymentMethod: PaymentMethod, supplierId: number) => {
  const response = await fetch("/api/subscriptions/purchase", {
    method: "POST",
    headers: {
      ...authHeaders(supplierToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      ...(paymentMethod === "card_terminal" ? { payment_method: "card_terminal", supplier_id: supplierId } : {}),
    }),
  });
  const payload = await readResponseBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(payload, "No pudimos activar la suscripción.");
    throw new Error(`Suscripción: ${message}`);
  }

  return (payload || {}) as PurchaseResponse;
};

export default function SellerSupplierWizard() {
  const { token, user } = useAuthStore();
  const [step, setStep] = useState<WizardStep>("plan");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<SupplierRegistrationForm>(initialForm);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

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

  const handleFormChange = (field: keyof SupplierRegistrationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (!form.name.trim()) return "Ingresa el nombre del proveedor.";
    if (!form.lastName.trim()) return "Ingresa el apellido paterno.";
    if (!form.email.trim()) return "Ingresa el correo electrónico.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Ingresa un correo electrónico válido.";
    if (!form.companyName.trim()) return "Ingresa el nombre de la empresa.";
    return null;
  };

  const checkCompanyNameAvailability = async () => {
    const response = await fetchWithAuth(`/api/suppliers/check-name?name=${encodeURIComponent(form.companyName.trim())}`);
    const body = await readResponseBody(response);

    if (response.status === 404 || response.status === 405) {
      return;
    }

    if (!response.ok) {
      const message = extractErrorMessage(body, "No pudimos validar si la empresa ya existe.");
      throw new Error(`Validación de empresa: ${translateErrorMessage(message, "No pudimos validar si la empresa ya existe.")}`);
    }

    if (body && typeof body === "object" && "exists" in body && Boolean((body as Record<string, unknown>).exists)) {
      throw new Error("Ya existe una empresa registrada con ese nombre. Usa otro nombre de empresa.");
    }
  };

  const createSupplierAndPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedPlan || !paymentMethod) {
      setError("Selecciona un paquete y método de pago.");
      return;
    }

    if (typeof user?.id !== "number") {
      setError("No pudimos identificar al vendedor de la sesión.");
      return;
    }

    if (!token) {
      setError("No encontramos una sesión activa para registrar el proveedor.");
      return;
    }

    setSubmitting(true);

    try {
      await checkCompanyNameAvailability();

      const password = generatePassword(form);
      setCreatedPassword(null);
      const userResponse = await fetch(apiUrl("/users/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          last_name: form.lastName.trim(),
          second_last_name: form.secondLastName.trim(),
          email: form.email.trim(),
          password,
          role: "supplier",
          is_active: true,
        }),
      });

      const userBody = await readResponseBody(userResponse);
      const userPayload = userBody && typeof userBody === "object" ? (userBody as Record<string, unknown>) : null;

      if (!userResponse.ok || typeof userPayload?.id !== "number") {
        const message = extractErrorMessage(userBody, "No pudimos crear el usuario proveedor.");
        throw new Error(`Usuario: ${translateErrorMessage(message, "No pudimos crear el usuario proveedor.")}`);
      }

      const supplierResponse = await fetch(apiUrl("/suppliers/"), {
        method: "POST",
        headers: authHeaders(token),
        body: buildSupplierFormData(userPayload.id, user.id, form),
      });

      const supplierBody = await readResponseBody(supplierResponse);

      if (!supplierResponse.ok) {
        const message = extractErrorMessage(supplierBody, "Usuario creado, pero no pudimos registrar la empresa.");
        throw new Error(`Proveedor: ${translateErrorMessage(message, "Usuario creado, pero no pudimos registrar la empresa.")}`);
      }

      const supplierPayload = supplierBody && typeof supplierBody === "object" ? (supplierBody as Record<string, unknown>) : null;
      const supplierId = Number(supplierPayload?.id);
      if (!Number.isFinite(supplierId)) {
        throw new Error("Proveedor: La empresa se creó, pero el servidor no devolvió el ID del proveedor.");
      }

      const supplierToken = await loginSupplierForPurchase(form.email.trim(), password);
      const purchase = await purchaseWithSupplierToken(supplierToken, selectedPlan.id, paymentMethod, supplierId);

      if (paymentMethod === "card") {
        if (!purchase.init_point) {
          throw new Error("Mercado Pago no devolvió una liga de pago.");
        }
        try {
          window.sessionStorage.setItem("last_supplier_generated_password", password);
        } catch {}
        window.location.href = purchase.init_point;
        return;
      }

      setCreatedPassword(password);
      setStep("done");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <WizardProgress step={step} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {step === "plan" ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">Paso 1</p>
            <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
              Elige el paquete del proveedor
            </h2>
            <p className="mt-1 text-sm text-gray-500">Solo se muestran paquetes activos disponibles para suscripción.</p>
          </div>

          {loadingPlans ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-gray-500">
              <Loader2 className="animate-spin text-primary" size={26} />
              Cargando paquetes...
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl bg-[#f2f3f4] p-5 text-sm text-gray-600">No hay paquetes activos disponibles.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const active = plan.id === selectedPlan?.id;
                const features = normalizePlanFeatures(plan.features, plan.description).slice(0, 5);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`flex h-full flex-col rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                        : "border-gray-100 bg-white hover:border-primary/30 hover:bg-[#f2f3f4]"
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-950">
                          {plan.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">{plan.description || "Paquete disponible"}</p>
                      </div>
                      {active ? <CheckCircle2 className="shrink-0 text-[#168e00]" size={22} /> : null}
                    </div>

                    <div className="mb-5">
                      <span className="text-3xl font-bold text-primary">{formatCurrency(plan.price)}</span>
                      <span className="ml-1 text-sm text-gray-500">/{getPlanPeriod(plan.duration)}</span>
                    </div>

                    <ul className="mt-auto space-y-2">
                      {features.map((feature, index) => (
                        <li key={`${plan.id}-${index}`} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="mt-0.5 shrink-0 text-[#168e00]" size={16} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={!selectedPlan}
              onClick={() => setStep("payment")}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "payment" ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">Paso 2</p>
            <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
              Elige el método de pago
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              El proveedor quedará asociado al paquete {selectedPlan ? selectedPlan.title : "seleccionado"}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PaymentOption
              active={paymentMethod === "card"}
              icon={<CreditCard size={24} />}
              title="Tarjeta de crédito"
              description="Continúa a Mercado Pago, igual que el registro público de proveedor."
              onClick={() => setPaymentMethod("card")}
            />
            <PaymentOption
              active={paymentMethod === "card_terminal"}
              icon={<MonitorSmartphone size={24} />}
              title="Pago con terminal"
              description="Registra la compra para cobro por terminal física."
              onClick={() => setPaymentMethod("card_terminal")}
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep("plan")}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              Volver
            </button>
            <button
              type="button"
              disabled={!paymentMethod}
              onClick={() => setStep("supplier")}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar al registro
            </button>
          </div>
        </section>
      ) : null}

      {step === "supplier" ? (
        <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <aside className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-28 lg:self-start">
            <SummaryPanel plan={selectedPlan} paymentMethod={paymentMethod} />
          </aside>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <form onSubmit={createSupplierAndPurchase} className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-[#168e00]">Registro de usuario</p>
                <h2 className="mt-2 font-[family-name:var(--font-varela-round)] text-3xl font-bold text-gray-950">
                  Crea la cuenta y paga el plan
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Creamos el usuario proveedor y vinculamos su empresa. La contraseña se genera automáticamente.
                </p>
              </div>

              <FormField
                label="Nombre"
                placeholder="Juan"
                value={form.name}
                onChange={(value) => handleFormChange("name", value)}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Apellido paterno"
                  placeholder="Pérez"
                  value={form.lastName}
                  onChange={(value) => handleFormChange("lastName", value)}
                />
                <FormField
                  label="Apellido materno"
                  placeholder="López"
                  value={form.secondLastName}
                  onChange={(value) => handleFormChange("secondLastName", value)}
                />
              </div>

              <FormField
                label="Correo electrónico"
                type="email"
                placeholder="juan@empresa.com"
                value={form.email}
                onChange={(value) => handleFormChange("email", value)}
              />

              <FormField
                label="Nombre de la empresa"
                placeholder="Mi Negocio S.A."
                value={form.companyName}
                onChange={(value) => handleFormChange("companyName", value)}
              />

              <div className="flex items-start gap-3 rounded-xl bg-[#f2f3f4] p-4 text-sm leading-6 text-gray-600">
                <LockKeyhole className="mt-0.5 shrink-0 text-primary" size={18} />
                La contraseña se genera de forma automática con los datos del proveedor y un valor aleatorio.
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  {paymentMethod === "card" ? "Crear y continuar a Mercado Pago" : "Crear y registrar pago terminal"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {step === "done" ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#168e00]/10 text-[#168e00]">
            <ShieldCheck size={30} />
          </div>
          <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
            Proveedor registrado
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            La solicitud de suscripción por terminal quedó registrada. Puedes volver al panel para revisar tus ganancias.
          </p>
          {createdPassword ? (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left">
              <p className="text-sm font-semibold text-primary">Contraseña temporal del proveedor</p>
              <div className="mt-2 rounded-xl border border-primary/15 bg-white px-4 py-3 font-mono text-lg font-bold text-gray-950">
                {createdPassword}
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Compártela con el proveedor y pídele cambiarla cuando pueda entrar a su cuenta.
              </p>
            </div>
          ) : null}
          <a
            href="/admin/dashboard"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Volver al panel
          </a>
        </section>
      ) : null}
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "plan", label: "Paquete" },
    { id: "payment", label: "Pago" },
    { id: "supplier", label: "Proveedor" },
  ];
  const currentIndex = step === "done" ? steps.length : steps.findIndex((item) => item.id === step);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((item, index) => {
          const active = index <= currentIndex;
          return (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active ? "bg-primary text-white" : "bg-[#f2f3f4] text-gray-500"
                }`}
              >
                {index + 1}
              </span>
              <span className={`hidden text-sm font-semibold sm:inline ${active ? "text-primary" : "text-gray-500"}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentOption({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition-all ${
        active ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-gray-100 hover:border-primary/30 hover:bg-[#f2f3f4]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${active ? "bg-primary text-white" : "bg-[#f2f3f4] text-primary"}`}>
          {icon}
        </span>
        {active ? <CheckCircle2 className="text-[#168e00]" size={22} /> : null}
      </div>
      <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
    </button>
  );
}

function SummaryPanel({ plan, paymentMethod }: { plan: Plan | null; paymentMethod: PaymentMethod | null }) {
  const features = plan ? normalizePlanFeatures(plan.features, plan.description).slice(0, 6) : [];

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f3f4] text-primary">
          <ReceiptText size={22} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Plan elegido</p>
          <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
            {plan?.title || "Paquete"}
          </h2>
        </div>
      </div>

      <div className="rounded-xl bg-[#f2f3f4] p-5">
        <p className="text-sm text-gray-500">Total a pagar</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-4xl font-bold text-primary">{formatCurrency(plan?.price || 0)}</span>
          <span className="pb-1 text-sm text-gray-500">/{plan ? getPlanPeriod(plan.duration) : "año"}</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-4 text-sm font-semibold text-gray-700">Incluye tu plan</p>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={`${feature}-${index}`} className="flex items-center gap-3 text-sm text-gray-600">
              <Check className="shrink-0 text-[#168e00]" size={18} />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-gray-100 p-4 text-sm leading-6 text-gray-500">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} />
        {paymentMethod === "card_terminal"
          ? "El pago se registrará para cobro por terminal."
          : "El pago se completa de forma segura en Mercado Pago."}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </label>
  );
}
