import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DemoActionButton } from "@/components/supplier/DemoActionButton";
import { getDemoContent, getDemoSupplier } from "@/lib/demoProfile";
import { absoluteMediaUrl, absoluteSiteUrl, stripHtml } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

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

export default async function DemoSupplierPage({ params }: Props) {
  const { slug } = await params;
  const supplier = await getDemoSupplier(slug);
  if (!supplier) notFound();
  const { products, services, menus } = await getDemoContent(slug);
  const headerImage = absoluteMediaUrl(supplier.header_image);
  const logo = absoluteMediaUrl(supplier.logo);

  return (
    <main className="min-h-screen bg-[#f2f3f4] pt-24 font-[family-name:var(--font-poppins)] md:pt-28">
      <section className="relative overflow-hidden bg-[#004e28] text-white">
        {headerImage && <Image src={headerImage} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />}
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-24">
          <span className="inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">Demostración</span>
          {logo && <Image src={logo} alt={`Logo de ${supplier.name}`} width={88} height={88} className="mt-7 h-20 w-20 rounded-2xl bg-white object-contain p-2" />}
          <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">{supplier.name}</h1>
          {supplier.short_description && <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">{stripHtml(supplier.short_description)}</p>}
          <p className="mt-6 max-w-2xl text-sm text-white/80">Este espacio muestra cómo podría verse un negocio en Drooopy. Sus productos y servicios son ejemplos y no admiten operaciones reales.</p>
          <Link href="/sell" className="mt-8 inline-flex rounded-full bg-[#168e00] px-7 py-3 font-semibold text-white transition hover:bg-[#137a00]">Quiero mi negocio en Drooopy</Link>
        </div>
      </section>

      {(supplier.description || supplier.about) && <section className="mx-auto max-w-6xl px-5 py-12 md:py-16" aria-labelledby="demo-about">
        <h2 id="demo-about" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">Conoce el negocio</h2>
        <p className="mt-5 max-w-3xl whitespace-pre-line leading-8 text-black">{stripHtml(supplier.about || supplier.description)}</p>
      </section>}

      {products.length > 0 && <section className="bg-white py-12 md:py-16" aria-labelledby="demo-products">
        <div className="mx-auto max-w-6xl px-5"><h2 id="demo-products" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">Productos</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => {
            const image = absoluteMediaUrl(product.thumbnail_url || product.image);
            return <article key={product.slug} className="overflow-hidden rounded-[2rem] bg-white shadow-[0_15px_35px_-20px_rgba(0,78,40,0.35)]">
              <div className="relative aspect-[4/3] bg-[#f2f3f4]">{image && <Image src={image} alt={product.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />}</div>
              <div className="space-y-3 p-6"><h3 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{product.title}</h3><p className="line-clamp-3 text-sm text-gray-600">{stripHtml(product.description)}</p><p className="text-xl font-bold text-[#004e28]">{money.format(product.price)}</p><DemoActionButton label="Ver opciones" /></div>
            </article>;
          })}</div>
        </div>
      </section>}

      {services.length > 0 && <section className="mx-auto max-w-6xl px-5 py-12 md:py-16" aria-labelledby="demo-services">
        <h2 id="demo-services" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">Servicios</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{services.map((service, index) => {
          const image = absoluteMediaUrl(service.images[0]);
          return <article key={`${service.title}-${index}`} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {image && <div className="relative aspect-[4/3]"><Image src={image} alt={service.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>}
            <div className="space-y-3 p-6"><h3 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{service.title}</h3><p className="text-sm leading-6 text-gray-600">{stripHtml(service.description)}</p><p className="text-xl font-bold text-[#004e28]">{money.format(service.price)}</p><DemoActionButton label="Solicitar servicio" /></div>
          </article>;
        })}</div>
      </section>}

      {menus.length > 0 && <section className="bg-white py-12 md:py-16" aria-labelledby="demo-menus"><div className="mx-auto max-w-6xl px-5">
        <h2 id="demo-menus" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">Menú</h2>
        <div className="mt-8 space-y-8">{menus.map((menu) => <article key={menu.id} className="rounded-2xl border border-gray-200 p-6">
          <h3 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">{menu.name}</h3>
          {menu.description && <p className="mt-2 text-gray-600">{stripHtml(menu.description)}</p>}
          <div className="mt-6 space-y-6">{menu.sections.map((section, index) => <div key={`${section.name}-${index}`}>
            <h4 className="font-semibold text-[#168e00]">{section.name}</h4>
            {section.description && <p className="text-sm text-gray-600">{stripHtml(section.description)}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{section.items.map((item, itemIndex) => <div key={`${item.name}-${itemIndex}`} className="flex gap-4 rounded-xl bg-[#f2f3f4] p-4">
              {item.image_url && <Image src={absoluteMediaUrl(item.image_url) || ""} alt={item.name} width={72} height={72} className="h-18 w-18 rounded-lg object-cover" />}
              <div><h5 className="font-semibold text-[#004e28]">{item.name}</h5>{item.description && <p className="mt-1 text-sm text-gray-600">{stripHtml(item.description)}</p>}{item.price != null && <p className="mt-2 font-bold text-[#004e28]">{money.format(item.price)}</p>}</div>
            </div>)}</div>
          </div>)}</div>
          <div className="mt-6"><DemoActionButton label="Hacer pedido" /></div>
        </article>)}</div>
      </div></section>}

      <section className="mx-auto max-w-6xl px-5 py-12 text-center text-sm text-gray-600">La galería de este proveedor aún no está disponible en la vista de demostración.</section>
    </main>
  );
}
