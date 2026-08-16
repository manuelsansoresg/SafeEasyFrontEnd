'use client';

import StepCheckout from './StepCheckout';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export type WizardStep = 'plan' | 'account' | 'supplier' | 'payment';

export default function WizardContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const selectedPlan = searchParams.get('plan') || '1';
  const referralCode = searchParams.get('referral_code') || '';

  useEffect(() => {
    if (!user) return;
    const preservedParams = new URLSearchParams(searchParams.toString());
    preservedParams.set('plan', selectedPlan);
    const role = user.role?.toLowerCase();
    const target = role === 'supplier' || role === 'admin'
      ? '/admin/my-subscription'
      : '/client/become-supplier';
    router.replace(`${target}?${preservedParams.toString()}`);
  }, [router, searchParams, selectedPlan, user]);

  if (user) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm font-medium text-gray-500">
        Preparando tu compra…
      </div>
    );
  }

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
