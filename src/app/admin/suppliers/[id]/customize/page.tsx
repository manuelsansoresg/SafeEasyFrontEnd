import { notFound } from "next/navigation";
import SiteBuilder from "@/components/supplier/site-builder/SiteBuilder";

export default async function CustomizeSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isSafeInteger(supplierId) || supplierId <= 0) notFound();
  return <SiteBuilder key={supplierId} supplierId={supplierId} />;
}
