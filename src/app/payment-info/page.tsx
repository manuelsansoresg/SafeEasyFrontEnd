"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Loader2, CreditCard, Copy, AlertCircle } from "lucide-react";

function PaymentInfoContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const amount = searchParams.get("amount");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferData, setTransferData] = useState<any>(null);

  useEffect(() => {
    if (slug) {
      fetchSupplierData();
    } else {
        setLoading(false);
        setError("No se proporcionó información del proveedor.");
    }
  }, [slug]);

  const fetchSupplierData = async () => {
    try {
        // Try with trailing slash first
        let res = await fetchWithAuth(`/api/suppliers/${slug}/`);
        if (!res.ok) {
            res = await fetchWithAuth(`/api/suppliers/${slug}`);
        }
        
        if (res.ok) {
            const data = await res.json();
            setTransferData(data);
        } else {
            setError("No se pudo obtener la información del proveedor.");
        }
    } catch (err) {
        setError("Error de conexión.");
    } finally {
        setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando información de pago...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                <CreditCard /> Datos de Transferencia
            </h1>
        </div>
        <div className="p-6 space-y-6">
             <div className="text-center pb-4 border-b">
                <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Monto a Pagar</p>
                <p className="text-4xl font-bold text-gray-900">
                    ${amount ? Number(amount).toLocaleString() : '0.00'}
                </p>
             </div>

             <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Proveedor</p>
                    <p className="font-semibold text-lg text-gray-900">{transferData?.name || transferData?.company_name || slug}</p>
                </div>

                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 space-y-4">
                    <div>
                        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Banco</p>
                        <p className="font-medium text-gray-900">{transferData?.transfer_bank || "No especificado"}</p>
                    </div>
                    <div>
                        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">CLABE Interbancaria</p>
                        <div className="flex items-center justify-between gap-2">
                             <p className="font-mono font-bold text-gray-900 break-all">
                                {transferData?.transfer_clabe || "No disponible"}
                             </p>
                             {transferData?.transfer_clabe && (
                                 <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(transferData.transfer_clabe);
                                        // Could add a toast here
                                    }} 
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors shrink-0"
                                    title="Copiar CLABE"
                                 >
                                     <Copy size={18} />
                                 </button>
                             )}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Beneficiario</p>
                        <p className="font-medium text-gray-900">{transferData?.transfer_name || "No especificado"}</p>
                    </div>
                </div>
             </div>

             <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                 <p className="font-medium flex items-center gap-2 mb-1">
                    <AlertCircle size={16} /> Importante
                 </p>
                 <p>Realiza la transferencia por el monto exacto y conserva tu comprobante para enviarlo al proveedor por el chat.</p>
             </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentInfoPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-gray-500">Cargando...</p>
        </div>
    }>
        <PaymentInfoContent />
    </Suspense>
  );
}
