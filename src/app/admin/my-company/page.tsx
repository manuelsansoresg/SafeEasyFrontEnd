'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import SupplierForm from '@/components/admin/SupplierForm';
import StepCarousel from '@/components/sell/wizard/StepCarousel';
import StepCertificates from '@/components/sell/wizard/StepCertificates';
import StepPersonalization from '@/components/sell/wizard/StepPersonalization';
import { useSearchParams, useRouter } from 'next/navigation';

function MyCompanyContent() {
  const { user, token } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialTab = (searchParams.get('tab') as 'info' | 'carousel' | 'certificates' | 'customization') || 'info';
  
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'carousel' | 'certificates' | 'customization'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: 'info' | 'carousel' | 'certificates' | 'customization') => {
    setActiveTab(tab);
    // Optional: Update URL without reload to reflect tab change
    router.replace(`/admin/my-company?tab=${tab}`);
  };

  const fetchSupplier = async () => {
    if (!user || !token) {
        return;
    }
    
    setLoading(true);
    try {
      // Direct fetch by user_id as requested with skip and limit to match working curl
      // Adding trailing slash explicitly as backend might be strict and curl used it
      const urlUserId = `/api/suppliers/?skip=0&limit=100&user_id=${user.id}`;
     
      
      const res = await fetch(urlUserId, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      console.log('Supplier fetch status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Supplier data received:', data);
        
        let mySupplier = null;
        if (Array.isArray(data)) {
            // If it returns an array, look for the matching user_id
            mySupplier = data.find((s: any) => Number(s.user_id) === Number(user.id));
        } else if (data && (data.items || Array.isArray(data.items))) {
             // Handle pagination structure { items: [], ... }
             mySupplier = data.items.find((s: any) => Number(s.user_id) === Number(user.id));
        } else if (data && data.id && Number(data.user_id) === Number(user.id)) {
            // If it returns a single object
            mySupplier = data;
        }

        if (mySupplier) {
            setSupplier(mySupplier);
        }
      }
    } catch (e) {
      console.error("Error fetching supplier", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && token) {
        fetchSupplier();
    }
  }, [user, token]);

  if (loading) return <div className="p-8">Cargando...</div>;

  if (!supplier) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Mi Empresa</h1>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
                <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                        No se encontró una empresa asociada automáticamente a su cuenta.
                    </p>
                </div>
            </div>
        </div>
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
          Encabezado
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
        <button
          onClick={() => handleTabChange('customization')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'customization' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Personalización
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
        
        {activeTab === 'customization' && token && (
          <StepPersonalization
            supplierId={supplier.id}
            token={token}
            initialData={supplier}
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
