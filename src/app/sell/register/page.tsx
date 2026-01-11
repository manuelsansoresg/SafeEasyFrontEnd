import WizardContainer from '@/components/sell/wizard/WizardContainer';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Comience a vender en SafeEasy
          </h1>
          <p className="text-gray-600">
            Complete los siguientes pasos para configurar su tienda.
          </p>
        </div>
        
        <Suspense fallback={<div>Cargando...</div>}>
          <WizardContainer />
        </Suspense>
      </div>
    </main>
  );
}
