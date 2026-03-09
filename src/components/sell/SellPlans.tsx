import Link from 'next/link';

export default function SellPlans() {
  const plans = [
    {
      name: 'Estándar',
      price: '$3,600',
      period: '/año',
      description: 'Ideal para negocios establecidos.',
      features: [
        'Hasta 500 productos',
        'Perfil verificado',
        'Soporte por correo',
        'Acceso al mercado global',
      ],
      buttonText: 'Empezar Ahora',
      highlight: false,
    },
    {
      name: 'Profesional',
      price: '$4,600',
      period: '/año',
      description: 'Para maximizar sus ventas.',
      features: [
        'Productos ilimitados',
        'Perfil verificado + Badge',
        'Prioridad en búsquedas',
        'Soporte prioritario 24/7',
        'Analíticas avanzadas',
      ],
      buttonText: 'Seleccionar Pro',
      highlight: true,
    },
  ];

  return (
    <section id="plans" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Elija el plan perfecto para su negocio
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Planes anuales diseñados para escalar con usted.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-2 ${
                plan.highlight ? 'border-2 border-primary ring-4 ring-primary/10' : 'border border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">
                  Recomendado
                </div>
              )}
              <div className="p-8 flex-grow">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-gray-600">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-8 bg-gray-50 mt-auto">
                <Link
                  href={`/sell/register?plan=${plan.name.toLowerCase()}`}
                  className={`block w-full text-center py-3 px-6 rounded-lg font-bold transition-colors ${
                    plan.highlight
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-white text-primary border-2 border-primary hover:bg-primary/5'
                  }`}
                >
                  {plan.buttonText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
