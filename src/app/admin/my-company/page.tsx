'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import type { ComponentProps } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { resolveCurrentSupplier } from '@/lib/currentSupplier';
import { ExternalLink } from 'lucide-react';
import SupplierForm from '@/components/admin/SupplierForm';
import StepCarousel from '@/components/sell/wizard/StepCarousel';
import StepCertificates from '@/components/sell/wizard/StepCertificates';
import BusinessHoursEditor from '@/components/admin/BusinessHoursEditor';
import { PageHero } from '@/components/ui/PageHero';
import { useSearchParams, useRouter } from 'next/navigation';

type SupplierForForm = NonNullable<ComponentProps<typeof SupplierForm>['initialData']> & { slug?: string };

function MyCompanyContent() {
  const { user, token } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const normalizeTab = (value: string | null): 'info' | 'carousel' | 'certificates' | 'hours' => {
    if (value === 'carousel' || value === 'certificates' || value === 'hours' || value === 'info') return value;
    return 'info';
  };
  const initialTab = normalizeTab(searchParams.get('tab'));
  
  const [supplier, setSupplier] = useState<SupplierForForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'carousel' | 'certificates' | 'hours'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: 'info' | 'carousel' | 'certificates' | 'hours') => {
    setActiveTab(tab);
    // Optional: Update URL without reload to reflect tab change
    router.replace(`/admin/my-company?tab=${tab}`);
  };

  const fetchSupplier = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !token) {
        return;
    }
    
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const mySupplier = await resolveCurrentSupplier(user);
      setSupplier(mySupplier as SupplierForForm | null);
    } catch (e) {
      console.error("Error fetching supplier", e);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [user, token]);

  useEffect(() => {
    if (user && token) {
        fetchSupplier();
    }
  }, [user, token, fetchSupplier]);

  if (loading) return <div className="p-8">Cargando...</div>;

  if (!supplier) {
    return (
      <div className="space-y-6">
        <PageHero title="Mi Empresa" subtitle="Gestiona la información pública de tu empresa." />
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
    <div className="space-y-6">
      <PageHero
        title="Gestionar Mi Empresa"
        subtitle="Actualiza los datos, encabezado, certificados y horarios de tu negocio."
        actions={
          supplier && supplier.slug ? (
            <a
                href={`/empresas/${supplier.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 font-medium flex items-center gap-2"
            >
                Ver mi empresa
                <ExternalLink size={18} />
            </a>
          ) : null
        }
      />
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
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
          onClick={() => handleTabChange('hours')}
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'hours' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Horarios de Atención
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'info' && (
          <SupplierForm initialData={supplier} isEditMode={true} onSaved={() => fetchSupplier({ silent: true })} />
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

        {activeTab === 'hours' && token && (
          <BusinessHoursEditor
            supplierId={supplier.id}
            token={token}
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
