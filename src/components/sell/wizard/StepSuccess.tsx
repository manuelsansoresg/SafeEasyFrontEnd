import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function StepSuccess() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">¡Registro Exitoso!</h2>
      <p className="text-xl text-gray-600 max-w-lg mb-8">
        Su cuenta de proveedor ha sido creada y configurada correctamente. Ahora puede acceder a su panel de control para administrar sus productos y perfil.
      </p>
      
      <div className="space-y-4">
        <Link
          href="/admin/dashboard" // Assuming admin dashboard handles suppliers too
          className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-colors shadow-lg"
        >
          Ir a mi Panel
        </Link>
        <div className="block">
          <Link href="/" className="text-gray-500 hover:text-primary text-sm">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
