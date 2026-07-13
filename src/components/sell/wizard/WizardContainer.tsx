'use client';

import StepCheckout from './StepCheckout';
import { useSearchParams } from 'next/navigation';

export type WizardStep = 'plan' | 'account' | 'supplier' | 'payment';

export default function WizardContainer() {
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get('plan') || 'estándar';
  const referralCode = searchParams.get('referral_code') || '';

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <div className="mb-6 rounded-lg border border-gray-100 bg-[#f2f3f4] px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-primary">Cuenta de proveedor</p>
          <p className="text-sm text-gray-500">Registra tu cuenta y continúa a Mercado Pago</p>
        </div>
      </div>
      <StepCheckout selectedPlan={selectedPlan} referralCode={referralCode} />
    </div>
  );
}
