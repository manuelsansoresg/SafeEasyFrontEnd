"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Plan, Subscription } from "@/types/subscriptions";
import {
  BadgeDollarSign,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

const RENEW_DAYS_THRESHOLD = 30;

const daysRemaining = (endDate: string): number => {
  const now = new Date();
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return 0;
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const totalDays = (sub: Subscription): number => {
  const duration = sub.plan?.duration;
  if (duration === "yearly") return 365;
  if (duration === "monthly") return 30;
  return 365;
};

const progressPercent = (sub: Subscription): number => {
  const remaining = daysRemaining(sub.end_date);
  const total = totalDays(sub);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
};

const isSubscriptionActive = (subscription: Subscription | null) => subscription?.status === "active";

const statusLabel = (subscription: Subscription | null) => {
  if (!subscription) return "Sin pago";
  if (subscription.status === "active") return "Activo";
  return "Pago no registrado";
};

export default function MySubscriptionPage() {
  const { token, user } = useAuthStore();
  const isSupplier = user?.role === "supplier";

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchMySubscription = useCallback(async () => {
    if (!token || !isSupplier) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionsService.getMySubscription();
      setSubscription(data);
    } catch (e) {
      console.error("Error fetching my subscription:", e);
      setError("No se pudo cargar la información de tu subscripción.");
    } finally {
      setLoading(false);
    }
  }, [isSupplier, token]);

  useEffect(() => {
    fetchMySubscription();
  }, [fetchMySubscription]);

  useEffect(() => {
    if (!token || !isSupplier) return;
    let mounted = true;

    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        const items = await subscriptionsService.listPlans();
        if (!mounted) return;
        const activePlans = items.filter((plan) => plan.is_active);
        setPlans(activePlans);
      } catch (e) {
        console.error("Error loading subscription plans:", e);
      } finally {
        if (mounted) setLoadingPlans(false);
      }
    };

    loadPlans();
    return () => {
      mounted = false;
    };
  }, [fetchMySubscription, token, isSupplier]);

  useEffect(() => {
    if (selectedPlanId || plans.length === 0) return;
    const currentPlanId = subscription?.plan_id;
    const currentPlanIsAvailable = plans.some((plan) => plan.id === currentPlanId);
    setSelectedPlanId(currentPlanIsAvailable ? currentPlanId : plans[0]?.id ?? null);
  }, [plans, selectedPlanId, subscription?.plan_id]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const shouldShowPaymentAction =
    !subscription ||
    !isSubscriptionActive(subscription) ||
    daysRemaining(subscription.end_date) <= RENEW_DAYS_THRESHOLD;

  const handlePaySelectedPlan = async () => {
    if (!selectedPlan) {
      setError("Selecciona un plan para continuar con el pago.");
      return;
    }

    setPaying(true);
    setError(null);
    try {
      const purchase = await subscriptionsService.purchase(selectedPlan.id);
      if (!purchase.init_point) {
        throw new Error("Mercado Pago no devolvió una liga de pago.");
      }
      window.location.href = purchase.init_point;
    } catch (e) {
      console.error("Error creating subscription payment:", e);
      setError(e instanceof Error ? e.message : "No pudimos crear la ficha de pago.");
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const mpPaymentId = searchParams.get("payment_id") || searchParams.get("collection_id");
    const mpStatus = searchParams.get("status") || searchParams.get("collection_status");
    if (!token || !isSupplier || !mpPaymentId || mpStatus !== "approved") return;

    let mounted = true;
    const refreshApprovedPayment = async () => {
      setRefreshingPayment(true);
      setError(null);
      try {
        await subscriptionsService.refreshPayment(mpPaymentId);
        if (mounted) await fetchMySubscription();
      } catch (e) {
        console.error("Error refreshing subscription payment:", e);
        if (mounted) setError("Tu pago fue aprobado, pero no pudimos actualizar la subscripción automáticamente. Intenta recargar en unos segundos.");
      } finally {
        if (mounted) setRefreshingPayment(false);
      }
    };

    refreshApprovedPayment();
    return () => {
      mounted = false;
    };
  }, [fetchMySubscription, token, isSupplier]);

  if (!isSupplier) {
    return (
      <div className="space-y-6">
        <PageHero title="Mi Subscripción" subtitle="Información de tu plan activo." />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="text-gray-400" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Acceso restringido</h2>
          <p className="text-gray-500">Solo proveedores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero title="Mi Subscripción" subtitle="Información de tu plan y pagos." />

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            Cargando subscripción...
          </div>
        </div>
      ) : refreshingPayment ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            Confirmando pago...
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="text-red-500" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={fetchMySubscription}
            className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            Reintentar
          </button>
        </div>
      ) : !subscription ? (
        <PaymentPlanPanel
          plans={plans}
          selectedPlanId={selectedPlanId}
          loadingPlans={loadingPlans}
          paying={paying}
          title="No se registró un pago"
          description="El proveedor ya existe. Elige un plan y genera la ficha de pago sin registrarte otra vez."
          onSelectPlan={setSelectedPlanId}
          onPay={handlePaySelectedPlan}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Info Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <BadgeDollarSign size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{subscription.plan?.title || "Plan"}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500">
                          {subscription.plan?.duration === "yearly" ? "Anual" : subscription.plan?.duration === "monthly" ? "Mensual" : "-"}
                        </span>
                        {isSubscriptionActive(subscription) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                            <CheckCircle size={12} />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <Clock size={12} />
                            Pago no registrado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-900">${subscription.plan?.price}</div>
                    <div className="text-xs text-gray-500">
                      {subscription.plan?.duration === "yearly" ? "por año" : "por mes"}
                    </div>
                  </div>
                </div>

                {subscription.plan?.description && (
                  <p className="mt-6 text-gray-600 text-sm">{subscription.plan.description}</p>
                )}
              </div>
            </div>

            {/* Progress & Dates */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
                {isSubscriptionActive(subscription) ? "Progreso" : "Estado del pago"}
              </h3>

              {isSubscriptionActive(subscription) ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Calendar size={16} className="text-gray-400" />
                  Expira: {formatDate(subscription.end_date)}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                  <Clock size={18} className="mt-0.5 shrink-0" />
                  Este plan todavía no está activo porque no se registró un pago aprobado. Puedes elegir un plan y pagar sin crear otra cuenta.
                </div>
              )}

              {isSubscriptionActive(subscription) ? (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mt-4">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        daysRemaining(subscription.end_date) <= RENEW_DAYS_THRESHOLD ? "bg-amber-400" : "bg-primary"
                      }`}
                      style={{ width: `${progressPercent(subscription)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-gray-500">{daysRemaining(subscription.end_date)} días restantes</span>
                    <span className="text-gray-400">{Math.round(progressPercent(subscription))}%</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">ID</span>
                  <span className="text-sm font-mono text-gray-900">#{subscription.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Estado</span>
                  {isSubscriptionActive(subscription) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                      <CheckCircle size={10} />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      <Clock size={10} />
                      {statusLabel(subscription)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Plan</span>
                  <span className="text-sm font-medium text-gray-900">{subscription.plan?.title}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Duración</span>
                  <span className="text-sm text-gray-900">
                    {subscription.plan?.duration === "yearly" ? "Anual" : "Mensual"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Precio</span>
                  <span className="text-sm font-bold text-gray-900">${subscription.plan?.price}</span>
                </div>
              </div>
            </div>

            {shouldShowPaymentAction ? (
              <PaymentPlanPanel
                compact
                plans={plans}
                selectedPlanId={selectedPlanId}
                loadingPlans={loadingPlans}
                paying={paying}
                title={isSubscriptionActive(subscription) ? "Próximo a vencer" : "Pago no registrado"}
                description={
                  isSubscriptionActive(subscription)
                    ? `Te quedan ${daysRemaining(subscription.end_date)} días. Puedes pagar otro periodo.`
                    : "El plan no está activo porque no hay un pago aprobado. Elige un plan y paga ahora."
                }
                onSelectPlan={setSelectedPlanId}
                onPay={handlePaySelectedPlan}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentPlanPanel({
  plans,
  selectedPlanId,
  loadingPlans,
  paying,
  title,
  description,
  compact = false,
  onSelectPlan,
  onPay,
}: {
  plans: Plan[];
  selectedPlanId: number | null;
  loadingPlans: boolean;
  paying: boolean;
  title: string;
  description: string;
  compact?: boolean;
  onSelectPlan: (planId: number) => void;
  onPay: () => void;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${compact ? "p-6" : "p-8"}`}>
      <div className={`flex gap-4 ${compact ? "items-start" : "items-center justify-center text-center flex-col"}`}>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <CreditCard size={24} />
        </div>
        <div className={compact ? "" : "max-w-xl"}>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <div className={`mt-6 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {loadingPlans ? (
          <div className="rounded-xl bg-[#f2f3f4] p-4 text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="animate-spin text-primary" size={18} />
            Cargando planes...
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl bg-[#f2f3f4] p-4 text-sm text-gray-500">No hay planes activos disponibles.</div>
        ) : (
          plans.map((plan) => {
            const active = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                    : "border-gray-100 hover:border-primary/30 hover:bg-[#f2f3f4]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-950">{plan.title}</div>
                    <div className="mt-1 text-sm text-gray-500">{plan.duration === "yearly" ? "Anual" : "Mensual"}</div>
                  </div>
                  {active ? <CheckCircle className="text-[#168e00]" size={18} /> : null}
                </div>
                <div className="mt-3 text-2xl font-bold text-primary">${plan.price}</div>
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={paying || loadingPlans || !selectedPlanId}
        className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {paying ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
        {paying ? "Creando ficha de pago..." : "Pagar ahora"}
      </button>
    </div>
  );
}
