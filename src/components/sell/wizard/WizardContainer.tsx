'use client';

import { useState } from 'react';
import StepPlan from './StepPlan';
import StepAccount from './StepAccount';
import StepSupplier from './StepSupplier';
import StepPayment from './StepPayment';
import { useSearchParams, useRouter } from 'next/navigation';

export type WizardStep = 'plan' | 'account' | 'supplier' | 'payment';

export default function WizardContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPlan = searchParams.get('plan') || 'básico';

  const [step, setStep] = useState<WizardStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [userId, setUserId] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    setStep('account');
  };

  const handleAccountCreated = (uid: number, t: string) => {
    setUserId(uid);
    setToken(t);
    setStep('supplier');
  };

  const handleSupplierCreated = (sid: number) => {
    setSupplierId(sid);
    setStep('payment');
  };

  const handlePaymentSuccess = () => {
    router.push('/admin/welcome');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-[600px] flex flex-col">
      {/* Progress Bar */}
      <div className="bg-gray-50 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {['Plan', 'Cuenta', 'Empresa', 'Pago'].map((label, index) => {
            const stepOrder = ['plan', 'account', 'supplier', 'payment'];
            const currentIndex = stepOrder.indexOf(step);
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={label} className="flex flex-col items-center z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                >
                  {index + 1}
                </div>
                <span className={`text-xs mt-2 font-medium ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow p-6 md:p-10">
        {step === 'plan' && <StepPlan selectedPlan={selectedPlan} onSelect={handlePlanSelect} />}
        {step === 'account' && <StepAccount plan={selectedPlan} onSuccess={handleAccountCreated} />}
        {step === 'supplier' && <StepSupplier userId={userId!} token={token!} onSuccess={handleSupplierCreated} />}
        {step === 'payment' && <StepPayment plan={selectedPlan} onSuccess={handlePaymentSuccess} />}
      </div>
    </div>
  );
}
