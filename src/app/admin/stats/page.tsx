"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Clock,
  DollarSign,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type DateRange = "last7" | "last30" | "month";
type StatsInterval = "day" | "week" | "month";

type SupplierStatsResponse = {
  summary?: {
    total_orders?: number | string | null;
  };
  timeline?: Array<Record<string, unknown>>;
};

type SupplierOrder = Record<string, unknown>;

type DashboardData = {
  supplierId: number;
  supplierName: string;
  stats: SupplierStatsResponse;
  orders: SupplierOrder[];
};

type ProductRow = {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
};

const PRIMARY = "#004e28";
const ACCENT = "#168e00";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendientes", color: "#f59e0b" },
  paid: { label: "Pagados", color: ACCENT },
  completed: { label: "Completados", color: PRIMARY },
  cancelled: { label: "Cancelados", color: "#6b7280" },
  rejected: { label: "Rechazados", color: "#ef4444" },
  expired: { label: "Expirados", color: "#9ca3af" },
  other: { label: "Otros", color: "#94a3b8" },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function unwrapList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const candidates = [record.items, record.results, record.data, record.orders];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStatus(value: unknown) {
  const raw = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (["paid", "pagado", "pago_verificado", "validated", "validado"].includes(raw)) return "paid";
  if (["completed", "completado", "delivered", "entregado"].includes(raw)) return "completed";
  if (["cancelled", "canceled", "cancelado"].includes(raw)) return "cancelled";
  if (["rejected", "rechazado", "payment_rejected", "pago_rechazado"].includes(raw)) return "rejected";
  if (["expired", "expirado", "checkout_expired"].includes(raw)) return "expired";
  if (["pending", "pendiente", "created", "creado"].includes(raw)) return "pending";
  return raw || "other";
}

function getPaymentStatus(order: SupplierOrder) {
  return normalizeStatus(order.payment_status ?? order.paymentStatus ?? order.status);
}

function getFulfillmentStatus(order: SupplierOrder) {
  return normalizeStatus(order.fulfillment_status ?? order.fulfillmentStatus ?? order.visual_status ?? order.status);
}

function isPaidOrder(order: SupplierOrder) {
  return getPaymentStatus(order) === "paid";
}

function getOrderItems(order: SupplierOrder) {
  const directItems = unwrapList(order.items ?? order.order_items ?? order.cart_items ?? order.lines);
  if (directItems.length > 0) return directItems.map(asRecord);

  const product = asRecord(order.product ?? order.product_detail);
  if (Object.keys(product).length === 0) return [];

  return [
    {
      product,
      product_id: order.product_id ?? product.id,
      title: product.title ?? order.product_title ?? order.title,
      quantity: order.quantity ?? 1,
      price_at_purchase: order.price_at_purchase ?? order.price ?? product.price,
    },
  ];
}

function getItemTitle(item: Record<string, unknown>) {
  const product = asRecord(item.product ?? item.product_detail);
  return String(
    item.product_title ??
      item.title ??
      item.name ??
      product.title ??
      product.name ??
      "Producto sin nombre",
  );
}

function getItemKey(item: Record<string, unknown>) {
  const product = asRecord(item.product ?? item.product_detail);
  return String(item.product_id ?? item.id ?? product.id ?? getItemTitle(item));
}

function getItemQuantity(item: Record<string, unknown>) {
  return Math.max(0, toNumber(item.quantity ?? item.qty ?? 0));
}

function getItemUnitPrice(item: Record<string, unknown>) {
  const product = asRecord(item.product ?? item.product_detail);
  return toNumber(
    item.price_at_purchase ??
      item.purchase_price ??
      item.unit_price ??
      item.price ??
      product.price,
  );
}

function getProductsRevenue(order: SupplierOrder) {
  return getOrderItems(order).reduce((sum, item) => sum + getItemQuantity(item) * getItemUnitPrice(item), 0);
}

function getDeliveryType(order: SupplierOrder) {
  const raw = String(order.delivery_type ?? order.deliveryType ?? "pickup").toLowerCase().trim();
  if (["shipping", "delivery", "envio", "envío"].includes(raw)) return "shipping";
  return "pickup";
}

async function fetchJson(url: string) {
  const response = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${url} ${text}`.trim());
  }
  return response.json() as Promise<unknown>;
}

function getDateRange(range: DateRange) {
  const now = new Date();
  if (range === "last7") return { start: subDays(now, 7), end: now };
  if (range === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
  return { start: subDays(now, 30), end: now };
}

function formatCurrency(value: number) {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDateLabel(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return String(value || "");
  return format(date, "dd MMM", { locale: es });
}

function MetricCard({
  title,
  value,
  helper,
  Icon,
}: {
  title: string;
  value: string;
  helper: string;
  Icon: typeof DollarSign;
}) {
  return (
    <div className="rounded-2xl border border-[#004e28]/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500 font-[family-name:var(--font-poppins)]">{title}</p>
          <div className="mt-2 text-2xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#004e28]/10 text-[#004e28]">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-gray-500 font-[family-name:var(--font-poppins)]">{helper}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm font-medium text-gray-400">{label}</div>;
}

export default function AdminStatsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("last30");
  const [interval, setInterval] = useState<StatsInterval>("day");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const me = asRecord(await fetchJson("/api/users/me"));
      const nestedUser = asRecord(me.user ?? me.data);
      const userSource = Object.keys(nestedUser).length > 0 ? nestedUser : me;
      const userId = toNumber(userSource.id);

      if (!userId) throw new Error("No se pudo identificar al usuario actual.");

      const suppliersResponse = await fetchJson(`/api/suppliers?user_id=${encodeURIComponent(String(userId))}`);
      const suppliers = unwrapList(suppliersResponse).map(asRecord);
      const supplier = suppliers.find((item) => toNumber(item.user_id ?? item.userId) === userId) ?? suppliers[0];
      const supplierId = toNumber(supplier?.id);

      if (!supplierId) throw new Error("No se encontró una empresa asociada a tu usuario.");

      const range = getDateRange(dateRange);
      const params = new URLSearchParams({
        start_date: range.start.toISOString(),
        end_date: range.end.toISOString(),
        interval,
      });

      const [statsResponse, ordersResponse] = await Promise.all([
        fetchJson(`/api/suppliers/${supplierId}/stats?${params.toString()}`),
        fetchJson(`/api/orders?supplier_id=${supplierId}&limit=100`),
      ]);

      setData({
        supplierId,
        supplierName: String(supplier.name ?? supplier.short_name ?? `Proveedor #${supplierId}`),
        stats: asRecord(statsResponse) as SupplierStatsResponse,
        orders: unwrapList(ordersResponse).map(asRecord),
      });
    } catch (caught) {
      console.error("Error loading supplier statistics", caught);
      setData(null);
      setError("No se pudieron cargar las estadísticas del proveedor.");
    } finally {
      setLoading(false);
    }
  }, [dateRange, interval]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const computed = useMemo(() => {
    const orders = data?.orders ?? [];
    const paidOrders = orders.filter(isPaidOrder);
    const paidOrdersCount = paidOrders.length;
    const productRevenue = paidOrders.reduce((sum, order) => sum + getProductsRevenue(order), 0);
    const shippingCollected = paidOrders.reduce((sum, order) => sum + toNumber(order.shipping_cost ?? order.shippingCost), 0);
    const platformFee = paidOrders.reduce((sum, order) => sum + toNumber(order.platform_fee ?? order.platformFee), 0);
    const pendingToPrepare = orders.filter(
      (order) => isPaidOrder(order) && getFulfillmentStatus(order) === "pending",
    ).length;
    const completedOrders = orders.filter((order) => getFulfillmentStatus(order) === "completed").length;
    const averageTicket = paidOrdersCount > 0 ? productRevenue / paidOrdersCount : 0;

    const productMap = new Map<string, ProductRow>();
    for (const order of paidOrders) {
      for (const item of getOrderItems(order)) {
        const key = getItemKey(item);
        const quantity = getItemQuantity(item);
        const revenue = quantity * getItemUnitPrice(item);
        const current = productMap.get(key);
        if (current) {
          current.quantity += quantity;
          current.revenue += revenue;
        } else {
          productMap.set(key, { key, name: getItemTitle(item), quantity, revenue });
        }
      }
    }

    const statusMap = new Map<string, number>();
    for (const order of orders) {
      const fulfillment = getFulfillmentStatus(order);
      const payment = getPaymentStatus(order);
      const status = fulfillment === "completed" ? "completed" : payment;
      const normalized = STATUS_META[status] ? status : "other";
      statusMap.set(normalized, (statusMap.get(normalized) ?? 0) + 1);
    }

    const deliveryMap = new Map<"pickup" | "shipping", number>([
      ["pickup", 0],
      ["shipping", 0],
    ]);
    for (const order of orders) {
      const deliveryType = getDeliveryType(order);
      deliveryMap.set(deliveryType, (deliveryMap.get(deliveryType) ?? 0) + 1);
    }

    const timeline = (data?.stats.timeline ?? []).map((item) => ({
      date: String(item.date ?? item.day ?? item.period ?? ""),
      amount: toNumber(item.amount ?? item.total_revenue ?? item.revenue ?? item.sales),
      count: toNumber(item.count ?? item.total_orders ?? item.orders),
    }));

    return {
      totalOrders: toNumber(data?.stats.summary?.total_orders),
      productRevenue,
      pendingToPrepare,
      completedOrders,
      paidOrdersCount,
      averageTicket,
      shippingCollected,
      platformFee,
      estimatedNet: productRevenue - platformFee,
      topProducts: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      statusData: Array.from(statusMap.entries()).map(([key, value]) => ({
        key,
        name: STATUS_META[key]?.label ?? key,
        value,
        color: STATUS_META[key]?.color ?? STATUS_META.other.color,
      })),
      deliveryData: [
        { key: "pickup", label: "Recoger", value: deliveryMap.get("pickup") ?? 0, color: PRIMARY },
        { key: "shipping", label: "Envío", value: deliveryMap.get("shipping") ?? 0, color: ACCENT },
      ],
      timeline,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#004e28]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h2 className="mt-4 text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Error</h2>
        <p className="mt-2 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-5 py-3 text-sm font-bold text-white hover:bg-[#00381d]"
        >
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const rangeLabel = dateRange === "last7" ? "Últimos 7 días" : dateRange === "month" ? "Este mes" : "Últimos 30 días";
  const hasTimeline = computed.timeline.some((item) => item.amount > 0 || item.count > 0);
  const hasStatuses = computed.statusData.some((item) => item.value > 0);
  const totalDelivery = computed.deliveryData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6 font-[family-name:var(--font-poppins)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#168e00]">Panel proveedor</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
            Estadísticas
          </h1>
          <p className="mt-1 text-gray-500">Ventas, pedidos y rentabilidad de {data.supplierName}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
          {([
            ["last7", "7 días"],
            ["last30", "30 días"],
            ["month", "Este mes"],
          ] as Array<[DateRange, string]>).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                dateRange === value ? "bg-[#004e28] text-white" : "text-gray-600 hover:bg-[#f2f3f4]"
              }`}
            >
              {label}
            </button>
          ))}
          <select
            value={interval}
            onChange={(event) => setInterval(event.target.value as StatsInterval)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10"
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Ingresos por productos"
          value={formatCurrency(computed.productRevenue)}
          helper="Órdenes pagadas, sin envío"
          Icon={DollarSign}
        />
        <MetricCard
          title="Pedidos totales"
          value={String(computed.totalOrders)}
          helper="Desde summary.total_orders"
          Icon={ShoppingBag}
        />
        <MetricCard
          title="Pendientes por preparar"
          value={String(computed.pendingToPrepare)}
          helper="Pagados con logística pendiente"
          Icon={Clock}
        />
        <MetricCard
          title="Completados"
          value={String(computed.completedOrders)}
          helper="Fulfillment completado"
          Icon={PackageCheck}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                Tendencia de ventas
              </h2>
              <p className="text-sm text-gray-500">{rangeLabel}, agrupado por {interval === "day" ? "día" : interval === "week" ? "semana" : "mes"}</p>
            </div>
            <TrendingUp className="text-[#168e00]" size={24} />
          </div>
          <div className="h-[340px]">
            {hasTimeline ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={computed.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(value) => `$${toNumber(value).toLocaleString("es-MX")}`} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(toNumber(value)), "Ingresos"]}
                    labelFormatter={formatDateLabel}
                    contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 18px 45px rgba(0,0,0,0.08)" }}
                  />
                  <Area type="monotone" dataKey="amount" stroke={ACCENT} strokeWidth={3} fill="url(#salesGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel label="No hay ventas para graficar en este periodo." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Estado de pedidos</h2>
          <p className="mt-1 text-sm text-gray-500">Distribución de las últimas 100 órdenes.</p>
          <div className="mt-5 h-[250px]">
            {hasStatuses ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={computed.statusData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={4}>
                    {computed.statusData.map((item) => (
                      <Cell key={item.key} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => [toNumber(value), "Pedidos"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel label="Sin estados para mostrar." />
            )}
          </div>
          <div className="mt-4 space-y-2">
            {computed.statusData.map((item) => (
              <div key={item.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Top productos vendidos</h2>
            <Store className="text-[#004e28]" size={21} />
          </div>
          <div className="mt-5 space-y-3">
            {computed.topProducts.length > 0 ? (
              computed.topProducts.map((product, index) => (
                <div key={product.key} className="rounded-2xl bg-[#f2f3f4] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#168e00]">#{index + 1}</p>
                      <p className="truncate font-bold text-gray-900">{product.name}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#004e28]">{product.quantity} uds.</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-600">{formatCurrency(product.revenue)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[#f2f3f4] p-6 text-center text-sm font-medium text-gray-500">
                Todavía no hay productos pagados.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Desglose financiero</h2>
            <Wallet className="text-[#004e28]" size={21} />
          </div>
          <div className="mt-5 space-y-4">
            {[
              ["Ticket promedio", formatCurrency(computed.averageTicket)],
              ["Envíos cobrados", formatCurrency(computed.shippingCollected)],
              ["Comisión plataforma", formatCurrency(computed.platformFee)],
              ["Neto estimado", formatCurrency(computed.estimatedNet)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-medium text-gray-500">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#004e28] p-4 text-white">
            <p className="text-xs font-semibold text-white/70">Pedidos pagados</p>
            <p className="mt-1 text-2xl font-bold font-[family-name:var(--font-varela-round)]">{computed.paidOrdersCount}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Método de entrega</h2>
            <Truck className="text-[#004e28]" size={21} />
          </div>
          <div className="mt-6 space-y-5">
            {computed.deliveryData.map((item) => {
              const percentage = totalDelivery > 0 ? Math.round((item.value / totalDelivery) * 100) : 0;
              return (
                <div key={item.key}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-900">{item.label}</span>
                    <span className="font-semibold text-gray-500">{item.value} pedidos</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#f2f3f4]">
                    <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{percentage}% del total</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
