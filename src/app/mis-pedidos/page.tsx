import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams?: { order_id?: string };
}) {
  const orderId = searchParams?.order_id ? String(searchParams.order_id) : "";
  const query = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
  redirect(`/client/orders${query}`);
}
