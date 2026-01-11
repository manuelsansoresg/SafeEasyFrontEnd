interface StepPlanProps {
  selectedPlan: string;
  onSelect: (plan: string) => void;
}

export default function StepPlan({ selectedPlan, onSelect }: StepPlanProps) {
  const plans = [
    {
      name: 'Básico',
      price: 'Gratis',
      features: ['50 productos', 'Perfil básico', 'Soporte email'],
    },
    {
      name: 'Profesional',
      price: '$499/mes',
      features: ['500 productos', 'Verificado', 'Soporte 24/7', 'Analíticas'],
    },
    {
      name: 'Empresarial',
      price: '$999/mes',
      features: ['Ilimitado', 'Gestor dedicado', 'API', 'Auditoría'],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">Selecciona tu Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            onClick={() => onSelect(plan.name.toLowerCase())}
            className={`cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
              selectedPlan.toLowerCase() === plan.name.toLowerCase()
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-gray-200 hover:border-primary/50'
            }`}
          >
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <p className="text-2xl font-bold text-primary mb-4">{plan.price}</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center text-sm text-gray-600">
                  <span className="text-green-500 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-2 rounded-lg font-bold ${
                selectedPlan.toLowerCase() === plan.name.toLowerCase()
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {selectedPlan.toLowerCase() === plan.name.toLowerCase() ? 'Seleccionado' : 'Elegir'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
