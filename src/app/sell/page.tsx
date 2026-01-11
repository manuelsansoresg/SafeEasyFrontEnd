import SellHero from '@/components/sell/SellHero';
import SellBenefits from '@/components/sell/SellBenefits';
import SellPlans from '@/components/sell/SellPlans';
import SellTestimonials from '@/components/sell/SellTestimonials';
import SellFAQ from '@/components/sell/SellFAQ';

export default function SellPage() {
  return (
    <main className="min-h-screen">
      <SellHero />
      <SellBenefits />
      <SellTestimonials />
      <SellPlans />
      <SellFAQ />
      
      {/* Call to Action Section */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            ¿Listo para expandir su negocio?
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto">
            Únase a miles de proveedores que ya confían en SafeEasy para sus ventas B2B.
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
