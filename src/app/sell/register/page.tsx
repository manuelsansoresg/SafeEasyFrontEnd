import WizardContainer from '@/components/sell/wizard/WizardContainer';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 pt-24 md:pt-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h1 className="font-[family-name:var(--font-varela-round)] text-3xl md:text-5xl text-gray-950 mb-3">
            Activa tu plan de proveedor
          </h1>
          <p className="text-base leading-8 text-gray-500 md:text-lg">
            Crea tu cuenta, revisa tu ficha de pago y continúa a Mercado Pago para completar la suscripción.
          </p>
        </div>
        
        <Suspense fallback={<div>Cargando...</div>}>
          <WizardContainer />
        </Suspense>
      </div>
    </main>
  );
}
