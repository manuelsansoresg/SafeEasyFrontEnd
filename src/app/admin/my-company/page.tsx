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

  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string, data?: any) => {
    console.log(msg, data || "");
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg} ${data ? JSON.stringify(data).substring(0, 100) : ''}`]);
  };

  const fetchSupplier = async () => {
    if (!user || !token) {
        // addLog("No user or token", { user: !!user, token: !!token });
        return;
    }
    
    setLoading(true);
    try {
      addLog(`Buscando empresa para usuario: ${user.id} (${user.email})`);
      
      // 1. Try explicit /me endpoint if available
      try {
          const resMe = await fetch('/api/suppliers/me', { headers: { Authorization: `Bearer ${token}` } });
          if (resMe.ok) {
              const dataMe = await resMe.json();
              if (dataMe && dataMe.id) {
                  addLog("Encontrado via /me", dataMe);
                  setSupplier(dataMe);
                  setLoading(false);
                  return;
              }
          }
      } catch (e) {}

      // 2. Try filtering by user_id or id as per backend update
      try {
        // First try standard user_id filter
        const urlUserId = `/api/suppliers?user_id=${user.id}`;
        addLog(`Fetching ${urlUserId}`);
        let res = await fetch(urlUserId, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
            let data = await res.json();
            addLog("Respuesta user_id:", Array.isArray(data) ? `Array(${data.length})` : `Object (keys: ${Object.keys(data).join(',')})`);
            
            let items = Array.isArray(data) ? data : data.items || [];
            // If API returns list, find match
            let mySupplier = items.find((s: any) => Number(s.user_id) === Number(user.id));
            
            // If backend returns single object instead of list (sometimes APIs do this)
            if (!Array.isArray(data) && data.id && Number(data.user_id) === Number(user.id)) {
                mySupplier = data;
            }

            if (mySupplier) {
                addLog("✅ Empresa encontrada por user_id:", mySupplier.name);
                setSupplier(mySupplier);
                setLoading(false);
                return;
            }
        }

        // Fallback: Try ?id={user.id} in case backend maps user ID to supplier ID or param name is 'id'
        const urlId = `/api/suppliers?id=${user.id}`;
        addLog(`Intentando fallback: ${urlId}`);
        res = await fetch(urlId, {
             headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
             let data = await res.json();
             addLog("Respuesta id:", Array.isArray(data) ? `Array(${data.length})` : `Object`);
             
             let items = Array.isArray(data) ? data : data.items || [];
             let mySupplier = items.find((s: any) => Number(s.user_id) === Number(user.id));

             if (!Array.isArray(data) && data.id && Number(data.user_id) === Number(user.id)) {
                 mySupplier = data;
             }

             if (mySupplier) {
                 addLog("✅ Empresa encontrada por id:", mySupplier.name);
                 setSupplier(mySupplier);
                 setLoading(false);
                 return;
             }
        }

      } catch (e) {
        addLog("Excepción buscando por ID (continuando...)", e);
      }

      // 3. Fallback to larger list
      try {
         addLog("No encontrado, intentando fetch general limit=1000");
         const res = await fetch(`/api/suppliers?limit=1000`, {
           headers: { Authorization: `Bearer ${token}` }
         });
         if (res.ok) {
           const data = await res.json();
           const items = Array.isArray(data) ? data : data.items || [];
           addLog(`General fetch items: ${items.length}`);
           const mySupplier = items.find((s: any) => Number(s.user_id) === Number(user.id));
           
           if (mySupplier) {
             addLog("✅ Empresa encontrada en lista general:", mySupplier.name);
             setSupplier(mySupplier);
             setLoading(false);
             return;
           }
         } else {
             addLog(`Error general fetch: ${res.status}`);
         }
      } catch (e) {
         addLog("Excepción en fetch general", e);
      }
      
      addLog("❌ No se encontró empresa vinculada tras intentar todos los métodos");
    } catch (e) {
      addLog("Error fetching supplier", e);
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

  const [manualSlug, setManualSlug] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const fetchBySlug = async () => {
    if (!manualSlug.trim() || !token) return;
    setManualLoading(true);
    try {
        addLog(`Intentando buscar por slug: ${manualSlug}`);
        const res = await fetch(`/api/suppliers/${manualSlug}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            addLog("✅ Empresa encontrada por slug:", data);
            addLog(`Comparación IDs: User(${user?.id}) vs Supplier(${data.user_id})`);
            setSupplier(data);
        } else {
            addLog(`❌ Error buscando slug ${manualSlug}: ${res.status}`);
            try {
                const errText = await res.text();
                addLog("Detalle error:", errText);
            } catch (e) {}
        }
    } catch (e) {
        addLog("Error en fetchBySlug", e);
    } finally {
        setManualLoading(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  if (!supplier) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Mi Empresa</h1>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
                <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                        No se encontró una empresa asociada automáticamente a su cuenta (ID: {user?.id}).
                    </p>
                </div>
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-md">
            <h2 className="text-lg font-medium mb-4">Buscar manualmente</h2>
            <p className="text-sm text-gray-600 mb-4">
                Si conoce el "slug" o nombre corto de su empresa (ej: xpert-shirts), ingréselo aquí para cargarla:
            </p>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={manualSlug}
                    onChange={(e) => setManualSlug(e.target.value)}
                    placeholder="Ej: xpert-shirts"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <button 
                    onClick={fetchBySlug}
                    disabled={manualLoading || !manualSlug}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                    {manualLoading ? 'Buscando...' : 'Buscar'}
                </button>
            </div>
        </div>

        <div className="mt-8 border-t pt-4">
            <h3 className="font-bold text-sm mb-2">Logs de Depuración:</h3>
            <div className="bg-gray-100 p-2 text-xs font-mono max-h-60 overflow-y-auto rounded border">
                {debugLogs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button onClick={fetchSupplier} className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded">Reintentar</button>
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
