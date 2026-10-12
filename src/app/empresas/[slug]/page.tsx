import { notFound } from "next/navigation";
import SupplierPageClient from "./SupplierPageClient";
import { getPublicSupplierProfile } from "@/lib/supplierProfile";
import Link from "next/link";
import type { Supplier } from "@/lib/products";

export default async function SupplierPage({ params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicSupplierProfile(slug);
  if (!profile) notFound();

  const products = profile.products.map((product) => ({
    id: String(product.id),
    title: product.title,
    description: product.description || "",
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    sku: product.sku || "",
    is_active: product.is_active !== false,
    supplier_id: profile.supplier.id,
    category_id: 0,
    subcategory_id: 0,
    slug: product.slug || String(product.id),
    average_rating: product.average_rating || undefined,
    thumbnail_url: product.thumbnail_url || product.image || null,
  }));

  return <>
    <nav aria-label={`Catálogo público de ${profile.supplier.name}`} className="sr-only focus-within:not-sr-only">
      {!profile.supplier.is_directory && <Link href={`/empresas/${profile.supplier.slug || profile.supplier.id}/productos`}>Ver catálogo de {profile.supplier.name}</Link>}
      {profile.products.filter((product) => product.is_active === true && product.slug).map((product) => (
        <Link key={String(product.id)} href={`/product/${product.slug}`}>{product.title}</Link>
      ))}
      {profile.services.filter((service) => service.is_active === true && !service.is_agenda_only).map((service) => (
        <Link key={service.id} href={`/servicios/${service.id}`}>{service.title}</Link>
      ))}
    </nav>
    <SupplierPageClient key={slug} initialSupplier={profile.supplier as unknown as Supplier} initialProducts={products} />
  </>;
}
