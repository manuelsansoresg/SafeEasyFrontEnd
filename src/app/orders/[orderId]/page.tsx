import { notFound, redirect } from "next/navigation";

type MercadoPagoReturnPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

const MERCADO_PAGO_RETURN_STATUSES = new Set(["success", "failure", "pending"]);

export default async function MercadoPagoReturnPage({
  params,
  searchParams,
}: MercadoPagoReturnPageProps) {
  const [{ orderId: rawOrderId }, { status: rawStatus }] = await Promise.all([
    params,
    searchParams,
  ]);
  const orderId = Number(rawOrderId);

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const destination = new URLSearchParams();

  if (status && MERCADO_PAGO_RETURN_STATUSES.has(status.toLowerCase())) {
    destination.set("status", status.toLowerCase());
  }

  const query = destination.toString();
  redirect(`/client/orders/${orderId}${query ? `?${query}` : ""}`);
}
