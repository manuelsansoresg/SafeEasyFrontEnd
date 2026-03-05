'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import SupplierForm from '@/components/admin/SupplierForm';
import StepCarousel from '@/components/sell/wizard/StepCarousel';
import StepCertificates from '@/components/sell/wizard/StepCertificates';
import { useSearchParams, useRouter } from 'next/navigation';

function MyCompanyContent() {
  const { user, token } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialTab = (searchParams.get('tab') as 'info' | 'carousel' | 'certificates') || 'info';
  
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'carousel' | 'certificates'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: 'info' | 'carousel' | 'certificates') => {
    setActiveTab(tab);
    // Optional: Update URL without reload to reflect tab change
    router.replace(`/admin/my-company?tab=${tab}`);
  };

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!user || !token) return;
      try {
        console.log("🔍 Buscando empresa para usuario:", user.id);
        
        // Intentar filtrar por user_id directamente (más eficiente si el backend lo soporta)
        let res = await fetch(`/api/suppliers?user_id=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        let data = await res.json();
        let items = Array.isArray(data) ? data : data.items || [];
        let mySupplier = items.find((s: any) => Number(s.user_id) === Number(user.id));

        // Si no se encuentra, intentar traer más items (por si es paginación)
        if (!mySupplier) {
           console.log("⚠️ No encontrado con filtro user_id, intentando fetch general...");
           res = await fetch(`/api/suppliers?limit=100`, {
             headers: { Authorization: `Bearer ${token}` }
           });
           if (res.ok) {
             data = await res.json();
             items = Array.isArray(data) ? data : data.items || [];
             mySupplier = items.find((s: any) => Number(s.user_id) === Number(user.id));
           }
        }
        
        if (mySupplier) {
          console.log("✅ Empresa encontrada:", mySupplier);
          setSupplier(mySupplier);
        } else {
          console.warn("❌ No se encontró empresa vinculada al usuario", user.id);
          console.log("📦 Items recibidos:", items);
        }
      } catch (e) {
        console.error("Error fetching supplier", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [user, token]);

  if (loading) return <div className="p-8">Cargando...</div>;

  if (!supplier) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Mi Empresa</h1>
        <p>No se encontró una empresa asociada a su cuenta.</p>
        {/* Optionally offer to create one if they are a supplier but have no company */}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Gestionar Mi Empresa</h1>
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 mb-8">
        <button
          onClick={() => handleTabChange('info')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'info' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Información General
        </button>
        <button
          onClick={() => handleTabChange('carousel')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'carousel' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Carrusel de Imágenes
        </button>
        <button
          onClick={() => handleTabChange('certificates')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'certificates' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Certificados
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'info' && (
          <SupplierForm initialData={supplier} isEditMode={true} />
        )}
        
        {activeTab === 'carousel' && token && (
          <StepCarousel 
            supplierId={supplier.id} 
            slug={supplier.slug || supplier.short_name || undefined}
            token={token} 
            onNext={() => setActiveTab('certificates')} 
          />
        )}

        {activeTab === 'certificates' && token && (
          <StepCertificates 
            supplierId={supplier.id} 
            slug={supplier.slug || supplier.short_name || undefined}
            token={token} 
            onNext={() => {}} 
          />
        )}
      </div>
    </div>
  );
}

export default function MyCompanyPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <MyCompanyContent />
    </Suspense>
  );
}
