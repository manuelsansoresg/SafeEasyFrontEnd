import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getDemoProduct, getDemoSupplier } from "@/lib/demoProfile";
import { absoluteMediaUrl } from "@/lib/seo";

export const metadata = { robots: { index: false, follow: false } };

const formatPrice = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export default async function DemoProductPage({ params, searchParams }: {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { slug, productSlug } = await params;
  const { desde } = await searchParams;
  const [supplier, product] = await Promise.all([getDemoSupplier(slug), getDemoProduct(slug, productSlug)]);
  if (!supplier || !product) notFound();

  const images = [...new Set([
    absoluteMediaUrl(product.image || product.thumbnail_url),
    ...(product.media ?? []).filter((item) => item.type === "image").map((item) => absoluteMediaUrl(item.url)),
  ].filter((url): url is string => Boolean(url)))];
  const backHref = `/demos/${encodeURIComponent(slug)}/productos/${desde === "sell" ? "?desde=sell" : ""}`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <Link href={backHref} className="font-semibold text-primary underline">Volver a productos</Link>
      <div className="grid gap-8 lg:grid-cols-2">
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3" aria-label="Galería del producto">
            {images.map((src, index) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" className={index === 0 ? "col-span-2" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${product.title} — foto ${index + 1}`} className="w-full rounded-2xl" />
              </a>
            ))}
          </div>
        )}
        <section className="space-y-4">
          <p className="text-sm font-semibold text-primary">{supplier.name} · Demostración</p>
          <h1 className="text-3xl font-semibold text-primary">{product.title}</h1>
          <p className="text-2xl font-bold">{formatPrice.format(product.price)} MXN</p>
          <div className="space-y-3 break-words text-gray-700" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
        </section>
      </div>
    </main>
  );
}
