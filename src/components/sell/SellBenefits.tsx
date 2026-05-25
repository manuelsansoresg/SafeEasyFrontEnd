export default function SellBenefits() {
  const benefits = [
    {
      title: 'Alcance Global',
      description: 'Llegue a millones de compradores B2B en todo el mundo.',
      icon: (
        <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Verificación de Negocio',
      description: 'Genere confianza con la insignia de proveedor verificado.',
      icon: (
        <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Escaparate Personalizado',
      description: 'Muestre sus productos en su propio sitio web dentro de SafeEasy.',
      icon: (
        <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: 'Gestión de Productos',
      description: 'Suba y administre su catálogo de productos fácilmente.',
      icon: (
        <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-[family-name:var(--font-varela-round)] text-3xl md:text-4xl text-gray-950 mb-4">
            ¿Por qué vender en Drooopy?
          </h2>
          <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-8">
            Herramientas simples para mostrar su negocio, administrar su catálogo y vender con más confianza.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="rounded-lg border border-gray-100 bg-white p-7 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f2f3f4] [&_svg]:h-7 [&_svg]:w-7">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-3">
                {benefit.title}
              </h3>
              <p className="text-sm leading-7 text-gray-500">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
