import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SupplierPageClient from "@/app/empresas/[slug]/SupplierPageClient";
import type { Supplier, CarouselImage } from "@/lib/products";
import { getDemoContent, getDemoSupplier, getSellDemos } from "@/lib/demoProfile";
import { absoluteMediaUrl, absoluteSiteUrl, stripHtml } from "@/lib/seo";
import { sellCampaignParams } from "@/lib/sellCampaignParams";
import type { Menu } from "@/types/menu";
import type { SupplierService } from "@/types/services";

type Props = {
  params: Promise<{ slug: string; tab?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getDemoSupplier(slug);
  if (!supplier) notFound();
  const url = absoluteSiteUrl(`/demos/${slug}`);
  return {
    title: `${supplier.name} — Demostración`,
    description: stripHtml(supplier.short_description || supplier.description || `Conoce la demostración de ${supplier.name} en Drooopy.`),
    alternates: { canonical: url },
    openGraph: { title: `${supplier.name} — Demostración`, url },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export default async function DemoSupplierPage({ params, searchParams }: Props) {
  const [{ slug, tab }, query] = await Promise.all([params, searchParams]);
  const demo = await getDemoSupplier(slug);
  if (!demo) notFound();
  const [{ products, services, menus }, featured] = await Promise.all([
    getDemoContent(slug),
    query.desde === "sell" ? getSellDemos() : Promise.resolve([]),
  ]);
  const agendaEnabled = demo.agenda_enabled === true && services.length > 0;
  const menuEnabled = demo.menu_enabled === true && menus.length > 0;
  if ((tab === "agenda" && !agendaEnabled) || (tab === "menu" && !menuEnabled)) {
    const params = sellCampaignParams(query);
    if (query.desde === "sell") params.set("desde", "sell");
    redirect(`/demos/${encodeURIComponent(slug)}/${params.size ? `?${params}` : ""}`);
  }

  const offer = featured.find((item) => item.slug === slug);
  const campaign = sellCampaignParams(query);
  const returnHref = campaign.size ? `/sell?${campaign}#demos` : "/sell#demos";
  if (offer) campaign.set("demo", offer.slug);
  const plansHref = campaign.size ? `/sell?${campaign}#plans` : "/sell#plans";

  // The demo has the same supplier presentation; its data comes from /demos.
  const carouselImages: CarouselImage[] = demo.carousel_images?.length
    ? demo.carousel_images
    : demo.header_image
      ? [{ id: demo.id, title: demo.name, description: "", image: demo.header_image, thumbnail: demo.header_image, supplier_id: demo.id }]
      : [];
  const supplier = {
    ...demo,
    slug,
    is_active: true,
    carousel_images: carouselImages,
    certificates: demo.certificates || [],
    business_hours: demo.business_hours || [],
  } as Supplier;
  const supplierProducts = products.map((product, index) => ({
    id: product.id ?? product.slug ?? index,
    title: product.title,
    description: product.description || "",
    price: Number(product.price) || 0,
    stock: Number((product as { stock?: number }).stock) || 0,
    sku: String((product as { sku?: string }).sku || ""),
    is_active: true,
    supplier_id: demo.id,
    category_id: 0,
    subcategory_id: 0,
    slug: product.slug,
    thumbnail_url: absoluteMediaUrl(product.thumbnail_url || product.image),
  }));
  const supplierServices: SupplierService[] = services.map((service, index) => ({
    ...service,
    id: service.id || String(index),
    supplier_id: demo.id,
    is_active: true,
    is_agenda_only: false,
    cover_image_url: absoluteMediaUrl(service.images?.[0]),
    cover_thumbnail_url: absoluteMediaUrl(service.images?.[0]),
    images: [],
    created_at: "",
    updated_at: "",
    category_id: null,
    subcategory_id: null,
    supplier_category_id: null,
    supplier_subcategory_id: null,
  }));
  const supplierMenus: Menu[] = menus.map((menu) => ({
    ...menu,
    image_url: absoluteMediaUrl(menu.image_url),
    image_thumbnail_url: absoluteMediaUrl(menu.image_thumbnail_url),
    sections: menu.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        image_url: absoluteMediaUrl(item.image_url),
        image_thumbnail_url: absoluteMediaUrl(item.image_thumbnail_url),
      })),
    })),
  }));

  return <>
    <SupplierPageClient
      key={slug}
      initialSupplier={supplier}
      initialProducts={supplierProducts}
      demoMenus={menuEnabled ? supplierMenus : []}
      demoAgendaEnabled={agendaEnabled}
      demoServices={supplierServices}
      demoGalleryImages={demo.gallery_images || []}
      isDemo
    />
    {query.desde === "sell" ? (
      <aside aria-label="Navegación de la demo" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 px-3 sm:bottom-5">
        <div className="pointer-events-auto mx-auto flex max-w-fit flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#004e28]/15 bg-white p-2 shadow-xl">
          <Link href={returnHref} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[#004e28] hover:bg-[#edf6ef]">
            Volver a los ejemplos
          </Link>
          <Link href={plansHref} className="inline-flex min-h-11 items-center rounded-xl bg-[#004e28] px-3 text-sm font-semibold text-white hover:bg-[#116f04]">
            {offer?.public_plan_id ? "Ver este plan" : "Ver planes para mi negocio"}
          </Link>
        </div>
      </aside>
    ) : null}
  </>;
}
