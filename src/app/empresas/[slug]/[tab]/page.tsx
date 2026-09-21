import { notFound } from "next/navigation";
import SupplierPage from "../page";

export default async function SupplierTabPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}) {
  const { tab } = await params;
  if (!["menu", "agenda", "productos"].includes(tab)) notFound();
  return <SupplierPage />;
}
