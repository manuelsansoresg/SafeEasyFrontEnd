import type {
  MenuOrder,
  MenuOrderFulfillmentType,
  MenuOrderStatus,
} from "@/types/menuOrder";

export const MENU_ORDER_STATUS_LABELS: Record<MenuOrderStatus, string> = {
  pending: "Recibido",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const MENU_ORDER_STATUS_CLASSES: Record<MenuOrderStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-blue-200 bg-blue-50 text-blue-800",
  preparing: "border-violet-200 bg-violet-50 text-violet-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed: "border-[#168e00]/20 bg-[#168e00]/10 text-[#116f00]",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

export const MENU_ORDER_STATUS_FLOW: MenuOrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

export const MENU_ORDER_ALLOWED_TRANSITIONS: Record<
  MenuOrderStatus,
  MenuOrderStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export function formatMenuOrderMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatMenuOrderDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fulfillmentLabel(type: MenuOrderFulfillmentType) {
  return type === "delivery" ? "Entrega a domicilio" : "Recoger en el negocio";
}

export function nextPrimaryStatus(status: MenuOrderStatus): MenuOrderStatus | null {
  if (status === "pending") return "confirmed";
  if (status === "confirmed") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "completed";
  return null;
}

export function nextPrimaryStatusLabel(status: MenuOrderStatus) {
  if (status === "pending") return "Confirmar pedido";
  if (status === "confirmed") return "Iniciar preparación";
  if (status === "preparing") return "Marcar como listo";
  if (status === "ready") return "Completar pedido";
  return null;
}

export function orderProgressIndex(order: MenuOrder) {
  if (order.status === "cancelled") return -1;
  return MENU_ORDER_STATUS_FLOW.indexOf(order.status);
}