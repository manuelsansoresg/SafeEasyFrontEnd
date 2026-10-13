import { notFound } from "next/navigation";
import DemoSupplierPage from "../page";

export default async function DemoSupplierTabPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}) {
  const { tab } = await params;
  if (!["menu", "agenda", "productos"].includes(tab)) notFound();
  return <DemoSupplierPage params={params} />;
}
