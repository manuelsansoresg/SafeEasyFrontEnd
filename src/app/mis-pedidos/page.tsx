import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ order_id?: string }>;
};

export default async function Page({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;
  const orderId = resolvedSearchParams?.order_id
    ? String(resolvedSearchParams.order_id)
    : "";
  const query = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
  redirect(`/client/orders${query}`);
}
