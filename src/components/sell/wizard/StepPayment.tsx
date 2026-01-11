'use client';

import { useState } from 'react';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface StepPaymentProps {
  onSuccess: () => void;
  plan: string;
}

export default function StepPayment({ onSuccess, plan }: StepPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Configurar Método de Pago</h2>
        <p className="text-gray-600 mt-2">
          Estás suscribiéndote al plan <span className="font-semibold text-primary capitalize">{plan}</span>.
          No se realizará ningún cargo durante el periodo de prueba.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CreditCard size={120} />
        </div>

        <form onSubmit={handlePayment} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre en la tarjeta</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como aparece en la tarjeta"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de tarjeta</label>
            <div className="relative">
              <input
                type="text"
                required
                value={cardNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                  setCardNumber(val.replace(/(\d{4})(?=\d)/g, '$1 '));
                }}
                placeholder="0000 0000 0000 0000"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pl-12 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
              />
              <CreditCard className="absolute left-4 top-3 text-gray-400" size={20} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiración</label>
              <input
                type="text"
                required
                value={expiry}
                onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (val.length >= 3) {
                        setExpiry(`${val.slice(0,2)}/${val.slice(2)}`);
                    } else {
                        setExpiry(val);
                    }
                }}
                placeholder="MM/AA"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="123"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
                <Lock className="absolute right-4 top-3 text-gray-400" size={16} />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg flex items-start gap-3 text-sm text-gray-600">
            <ShieldCheck className="text-green-600 flex-shrink-0" size={20} />
            <p>
              Tus datos están protegidos con encriptación SSL de 256-bits. 
              Esta es una demostración, no se realizará ningún cargo real.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? (
              <>Processing...</>
            ) : (
              <>Completar Suscripción</>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
