"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  CircleDollarSign,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Unlink,
  Wallet,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { startMercadoPagoConnect } from "@/lib/mercadoPagoConnect";
import { PageHero } from "@/components/ui/PageHero";

type CommissionRecord = Record<string, unknown>;

type SellerStats = {
  total_commissions?: number;
  total_commission?: number;
  total_earned?: number;
  accumulated_commissions?: number;
  pending_commissions?: number;
  pending_commission?: number;
  pending_total?: number;
  commission_history?: CommissionRecord[];
};

type NormalizedMpAccount = {
  connected: boolean;
  email: string | null;
};

const readErrorMessage = async (response: Response) => {
  const text = await response.text().catch(() => "");
  if (!text) return `Error ${response.status}: ${response.statusText}`;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof detail === "string") return `Error ${response.status}: ${detail}`;
    if (detail) return `Error ${response.status}: ${JSON.stringify(detail)}`;
  } catch {}

  return `Error ${response.status}: ${text}`;
};

const formatCurrency = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number.isFinite(amount) ? amount : 0);
};

const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getNumber = (record: Record<string, unknown> | null, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
};

const getText = (record: Record<string, unknown>, keys: string[], fallback: string) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getString = (record: Record<string, unknown> | null, key: string) =>
  record && typeof record[key] === "string" ? record[key] : null;

const getBool = (record: Record<string, unknown> | null, key: string) =>
  record && typeof record[key] === "boolean" ? record[key] : null;

const normalizeMpAccount = (payload: unknown): NormalizedMpAccount | null => {
  const normalizeFromRecord = (record: Record<string, unknown>): NormalizedMpAccount | null => {
    const direct =
      getBool(record, "connected") ??
      getBool(record, "is_connected") ??
      getBool(record, "isLinked") ??
      getBool(record, "is_linked") ??
      getBool(record, "linked") ??
      getBool(record, "mp_is_linked") ??
      getBool(record, "mpIsLinked");

    let connected = direct;
    if (connected == null) {
      const status = getString(record, "status") || getString(record, "state") || getString(record, "connection_status");
      if (status) {
        const key = status.toLowerCase();
        if (["connected", "linked", "active", "ok"].includes(key)) connected = true;
        if (["disconnected", "unlinked", "inactive"].includes(key)) connected = false;
      }
    }
    if (connected == null) {
      connected =
        typeof record.access_token === "string" ||
        typeof record.token === "string" ||
        typeof record.refresh_token === "string";
    }

    const account = isRecord(record.account) ? record.account : null;
    const email =
      getString(record, "email") ||
      getString(record, "account_email") ||
      getString(record, "payer_email") ||
      getString(record, "connected_email") ||
      getString(record, "mp_email") ||
      getString(record, "mp_connected_email") ||
      getString(account, "email");

    return { connected: Boolean(connected), email };
  };

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (!isRecord(entry)) continue;
      const provider = (getString(entry, "provider") || getString(entry, "platform") || getString(entry, "name") || "").toLowerCase();
      const accountType = (getString(entry, "account_type") || getString(entry, "type") || "").toLowerCase();
      if (provider && !provider.includes("mercado")) continue;
      if (accountType && accountType !== "seller") continue;
      return normalizeFromRecord(entry);
    }
    return null;
  }

  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.payment_accounts)) return normalizeMpAccount(payload.payment_accounts);
  if (Array.isArray(payload.accounts)) return normalizeMpAccount(payload.accounts);
  return normalizeFromRecord(payload);
};

const readPlainError = async (response: Response) => {
  const text = await response.text().catch(() => "");
  return text || `Error ${response.status}`;
};

export default function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const [origin, setOrigin] = useState("");
  const [mpAccount, setMpAccount] = useState<NormalizedMpAccount>({ connected: false, email: null });
  const [mpStatusLoading, setMpStatusLoading] = useState(false);
  const [mpConnectLoading, setMpConnectLoading] = useState(false);
  const [mpDisconnectLoading, setMpDisconnectLoading] = useState(false);
  const [mpMessage, setMpMessage] = useState<string | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set("start_date", dateRange.start);
      if (dateRange.end) {
        params.set("end_date", dateRange.end);
      }

      const query = params.toString() ? `?${params.toString()}` : "";
      const [statsResponse, meResponse] = await Promise.all([
        fetchWithAuth(`/api/sellers/me/stats${query}`),
        fetchWithAuth("/api/sellers/me"),
      ]);

      if (!statsResponse.ok) {
        const message = await readErrorMessage(statsResponse);
        setStats(null);
        setSummary(null);
        setError(
          statsResponse.status === 404
            ? "No encontramos un perfil de vendedor vinculado a esta cuenta."
            : message
        );
        return;
      }

      const statsData = (await statsResponse.json().catch(() => null)) as SellerStats | null;
      const meData = meResponse.ok ? ((await meResponse.json().catch(() => null)) as Record<string, unknown> | null) : null;

      setStats(statsData);
      setSummary(meData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión al cargar el panel.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    setOrigin(configuredUrl || window.location.origin);
  }, []);

  const loadMercadoPagoAccount = useCallback(async () => {
    setMpStatusLoading(true);
    setMpError(null);

    try {
      const candidates = [
        "/api/mercadopago/account?account_type=seller",
        "/api/mercadopago/status?account_type=seller",
        "/api/mercadopago/account-status?account_type=seller",
      ];

      for (const url of candidates) {
        const response = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
        if (response.ok) {
          const data = await response.json().catch(() => null);
          const normalized = normalizeMpAccount(data);
          if (normalized) {
            setMpAccount(normalized);
            return;
          }
        } else if (response.status !== 404) {
          throw new Error(await readPlainError(response));
        }
      }

      const meResponse = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
      if (!meResponse.ok) {
        setMpAccount({ connected: false, email: null });
        return;
      }
      const meData = await meResponse.json().catch(() => null);
      setMpAccount(normalizeMpAccount(meData) ?? { connected: false, email: null });
    } catch (error) {
      setMpError(error instanceof Error ? error.message : "No se pudo validar Mercado Pago.");
    } finally {
      setMpStatusLoading(false);
    }
  }, []);

  useEffect(() => {
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
  }, [loadMercadoPagoAccount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") !== "callback" || params.get("mp_account_type") !== "seller") return;

    setMpMessage("Regresaste de Mercado Pago. Estamos validando la vinculación.");
    let attempts = 0;
    loadMercadoPagoAccount();
    const interval = window.setInterval(() => {
      attempts += 1;
      loadMercadoPagoAccount();
      if (attempts >= 10) window.clearInterval(interval);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [loadMercadoPagoAccount]);

  useEffect(() => {
    if (!mpAccount.connected) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") === "callback") setMpMessage("Cuenta de Mercado Pago vinculada correctamente.");
  }, [mpAccount.connected]);

  const history = useMemo(() => {
    const raw = stats?.commission_history;
    return Array.isArray(raw) ? raw.slice(0, 50) : [];
  }, [stats?.commission_history]);

  const totalEarned =
    getNumber(stats ?? null, ["total_commissions", "total_commission", "total_earned", "accumulated_commissions"]) ||
    getNumber(summary, ["total_commissions", "total_commission", "total_earned", "accumulated_commissions"]);
  const pending = getNumber(stats ?? null, ["pending_commissions", "pending_commission", "pending_total"]);
  const paid = Math.max(totalEarned - pending, 0);
  const sellerCode = summary ? getText(summary, ["seller_code", "code", "referral_code"], "") : "";
  const referralUrl = sellerCode ? `${origin || ""}/sell?referral_code=${encodeURIComponent(sellerCode)}` : "";

  const copyToClipboard = async (value: string, type: "code" | "url") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const handleMercadoPagoConnect = async () => {
    setMpConnectLoading(true);
    setMpError(null);
    setMpMessage(null);
    try {
      await startMercadoPagoConnect("seller");
    } catch (error) {
      setMpError(error instanceof Error ? error.message : "No se pudo iniciar la vinculación con Mercado Pago.");
      setMpConnectLoading(false);
    }
  };

  const handleMercadoPagoDisconnect = async () => {
    setMpDisconnectLoading(true);
    setMpError(null);
    setMpMessage(null);
    try {
      const response = await fetchWithAuth("/api/mercadopago/disconnect?account_type=seller", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(await readPlainError(response));
      setMpMessage("Cuenta de Mercado Pago desvinculada correctamente.");
      await loadMercadoPagoAccount();
    } catch (error) {
      setMpError(error instanceof Error ? error.message : "No se pudo desvincular Mercado Pago.");
    } finally {
      setMpDisconnectLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Panel vendedor"
        title="Tus proveedores y comisiones"
        subtitle="Registra proveedores, consulta tus ganancias y revisa las últimas comisiones generadas."
        actions={
          <Link
            href="/admin/suppliers/create"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            <Plus size={18} />
            Registrar proveedor
          </Link>
        }
      />

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Código de vinculación</p>
            <h2 className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-900">
              {sellerCode || "Sin código asignado"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Comparte esta URL para que el registro de proveedor se abra con tu código.
            </p>
          </div>

          <div className="min-w-0 lg:w-[560px]">
            <div className="rounded-xl border border-gray-100 bg-[#f2f3f4] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">URL de registro</p>
              <p className="mt-1 truncate font-mono text-sm text-gray-800">{referralUrl || "Código no disponible"}</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!sellerCode}
                onClick={() => copyToClipboard(sellerCode, "code")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={16} />
                {copied === "code" ? "Código copiado" : "Copiar código"}
              </button>
              <button
                type="button"
                disabled={!referralUrl}
                onClick={() => copyToClipboard(referralUrl, "url")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={16} />
                {copied === "url" ? "URL copiada" : "Copiar URL"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                mpAccount.connected ? "bg-[#168e00]/10 text-[#168e00]" : "bg-[#004e28]/10 text-primary"
              }`}
            >
              {mpStatusLoading ? <Loader2 size={22} className="animate-spin" /> : <CreditCard size={22} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Mercado Pago</p>
              <h2 className="mt-1 font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-900">
                {mpAccount.connected ? "Cuenta vinculada para comisiones" : "Vincula tu cuenta para recibir comisiones"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                {mpAccount.connected
                  ? mpAccount.email || "Tu cuenta está lista para recibir pagos de comisiones."
                  : "Conecta Mercado Pago para que tus comisiones queden asociadas a tu cuenta de vendedor."}
              </p>
              {mpMessage ? <p className="mt-2 text-sm font-medium text-[#168e00]">{mpMessage}</p> : null}
              {mpError ? <p className="mt-2 text-sm font-medium text-red-600">{mpError}</p> : null}
            </div>
          </div>

          {mpAccount.connected ? (
            <button
              type="button"
              onClick={handleMercadoPagoDisconnect}
              disabled={mpDisconnectLoading || mpStatusLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
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
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={<Wallet size={24} />} label="Comisiones ganadas" value={formatCurrency(totalEarned)} tone="green" />
        <MetricCard icon={<CircleDollarSign size={24} />} label="Pendientes" value={formatCurrency(pending)} tone="amber" />
        <MetricCard icon={<CheckCircle2 size={24} />} label="Liquidadas estimadas" value={formatCurrency(paid)} tone="emerald" />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-900">
              Historial de comisiones
            </h2>
            <p className="text-sm text-gray-500">Últimas 50 comisiones, con filtro opcional por fecha.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DateInput label="Desde" value={dateRange.start} onChange={(start) => setDateRange((prev) => ({ ...prev, start }))} />
            <DateInput label="Hasta" value={dateRange.end} onChange={(end) => setDateRange((prev) => ({ ...prev, end }))} />
            <button
              type="button"
              onClick={loadStats}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-gray-500">
            <Loader2 className="animate-spin text-primary" size={28} />
            Cargando ganancias...
          </div>
        ) : error ? (
          <div className="m-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle size={20} />
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center text-gray-500">
            <Store className="text-primary" size={34} />
            <p className="font-semibold text-gray-700">Aún no hay comisiones en este rango.</p>
            <p className="max-w-md text-sm">Cuando tus proveedores generen ventas, aparecerán aquí tus comisiones más recientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Proveedor</th>
                  <th className="px-5 py-3 font-semibold">Orden</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((item, index) => (
                  <CommissionRow key={String(item.id ?? item.commission_id ?? index)} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "green" | "amber" | "emerald" }) {
  const toneClass = {
    green: "bg-[#004e28]/10 text-[#004e28]",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-[#168e00]/10 text-[#168e00]",
  }[tone];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
      <Calendar size={16} className="text-gray-400" />
      <span className="font-medium">{label}</span>
      <input
        type="date"
        className="min-w-0 border-0 bg-transparent text-sm text-gray-800 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CommissionRow({ item }: { item: CommissionRecord }) {
  const amount = getNumber(item, ["commission_amount", "commission", "amount", "value", "total"]);
  const supplier = getText(item, ["supplier_name", "provider_name", "business_name", "supplier"], "Proveedor sin nombre");
  const order = getText(item, ["order_id", "order_number", "order", "sale_id"], "Sin orden");
  const status = getText(item, ["status", "payment_status", "commission_status"], "pendiente");
  const date = item.created_at ?? item.date ?? item.paid_at ?? item.updated_at;

  return (
    <tr className="transition-colors hover:bg-gray-50">
      <td className="px-5 py-4 text-gray-600">{formatDate(date)}</td>
      <td className="px-5 py-4 font-semibold text-gray-900">{supplier}</td>
      <td className="px-5 py-4 text-gray-600">{order}</td>
      <td className="px-5 py-4">
        <span className="inline-flex rounded-full bg-[#168e00]/10 px-2.5 py-1 text-xs font-semibold capitalize text-[#168e00]">
          {status}
        </span>
      </td>
      <td className="px-5 py-4 text-right font-bold text-gray-900">{formatCurrency(amount)}</td>
    </tr>
  );
}
