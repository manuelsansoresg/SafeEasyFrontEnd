import { notFound } from "next/navigation";
import DemoSupplierPage from "../page";

export default async function DemoSupplierTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await params;
  if (!["menu", "agenda", "productos"].includes(tab)) notFound();
  return <DemoSupplierPage params={params} searchParams={searchParams} />;
}
