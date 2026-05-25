"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Subscription } from "@/types/subscriptions";
import {
  BadgeDollarSign,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
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

export default function MySubscriptionPage() {
  const { token, user } = useAuthStore();
  const isSupplier = user?.role === "supplier";

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMySubscription = async () => {
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
  };

  useEffect(() => {
    fetchMySubscription();
  }, [token, isSupplier]);

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
      <PageHero title="Mi Subscripción" subtitle="Información de tu plan activo." />

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            Cargando subscripción...
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-6">
            <BadgeDollarSign className="text-primary" size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Sin subscripción activa</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Actualmente no tienes un plan contratado. Adquiere uno para disfrutar de todos los beneficios de la plataforma.
          </p>
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 font-medium"
          >
            <CreditCard size={20} />
            Ver planes disponibles
          </Link>
        </div>
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
                        {subscription.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                            <CheckCircle size={12} />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                            <XCircle size={12} />
                            Expirado
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Progreso</h3>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <Calendar size={16} className="text-gray-400" />
                Expira: {formatDate(subscription.end_date)}
              </div>

              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mt-4">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    subscription.status === "expired"
                      ? "bg-red-400"
                      : daysRemaining(subscription.end_date) <= RENEW_DAYS_THRESHOLD
                        ? "bg-amber-400"
                        : "bg-primary"
                  }`}
                  style={{ width: `${subscription.status === "expired" ? 100 : progressPercent(subscription)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-gray-500">
                  {subscription.status === "active"
                    ? `${daysRemaining(subscription.end_date)} días restantes`
                    : "Vencido"}
                </span>
                <span className="text-gray-400">
                  {Math.round(progressPercent(subscription))}%
                </span>
              </div>
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
                  {subscription.status === "active" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                      <CheckCircle size={10} />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                      <XCircle size={10} />
                      Expirado
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

            {/* Renew / Expired Actions */}
            {(subscription.status === "expired" || daysRemaining(subscription.end_date) <= RENEW_DAYS_THRESHOLD) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {subscription.status === "expired" ? "Subscripción vencida" : "Próximo a vencer"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {subscription.status === "expired"
                        ? "Tu plan ya no está activo."
                        : `Te quedan ${daysRemaining(subscription.end_date)} días.`}
                    </p>
                  </div>
                </div>
                <Link
                  href="/sell"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 font-medium"
                >
                  <CreditCard size={18} />
                  Renovar ahora
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
