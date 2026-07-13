import SellHero from '@/components/sell/SellHero';
import SellBenefits from '@/components/sell/SellBenefits';
import SellPlans from '@/components/sell/SellPlans';
import SellTestimonials from '@/components/sell/SellTestimonials';
import SellFAQ from '@/components/sell/SellFAQ';

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const accessCode = typeof resolvedSearchParams.code === 'string' ? resolvedSearchParams.code.trim() : '';

  return (
    <main className="min-h-screen pt-24 md:pt-28">
      <SellHero />
      <SellBenefits />
      <SellTestimonials />
      <SellPlans accessCode={accessCode} />
      <SellFAQ />
      
      {/* Call to Action Section */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            ¿Listo para expandir su negocio?
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto">
            Únase a miles de proveedores que ya confían en Drooopy para sus ventas B2B.
          </p>
          <a
            href="/sell/register"
            className="inline-block bg-white text-primary font-bold py-4 px-10 rounded-full text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            Regístrese Ahora
          </a>
        </div>
      </section>
    </main>
  );
}
