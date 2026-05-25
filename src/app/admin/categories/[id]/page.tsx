"use client";

import { useState, useEffect } from "react";
import CategoryForm from "@/components/admin/CategoryForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  is_active: boolean;
  slug: string;
}

export default function EditCategoryPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategory = async () => {
      if (!token || !id) return;
      
      try {
        const response = await fetchWithAuth(`/api/categories/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setCategory(data);
        } else {
            // Fallback: Fetch list and find category (in case direct fetch by ID is not supported or returns 404)
            // Note: API documentation says GET /categories/ accepts 'id' param, but let's try direct path first as above.
            // If that fails, maybe we try with query param?
            // Actually, usually REST is /categories/{id}.
            // If the user says "esto devuelve el api de categorias... listado... id", it might mean filtering by id on list endpoint.
            // Let's assume standard REST first, if fails, try fallback.
            
            console.warn(`Direct fetch failed (${response.status}). Checking if we need to filter list...`);
            const listResponse = await fetchWithAuth(`/api/categories/?id=${id}`);
            if (listResponse.ok) {
                const listData = await listResponse.json();
                if (Array.isArray(listData) && listData.length > 0) {
                    setCategory(listData[0]);
                } else {
                    setError("Categoría no encontrada");
                }
            } else {
                setError("No se pudo cargar la categoría");
            }
        }
      } catch (err: any) {
        console.error("Error fetching category:", err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p>Cargando información de la categoría...</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h2 className="text-xl font-bold text-gray-800">Error</h2>
        <p className="text-gray-500">{error || "Categoría no encontrada"}</p>
        <Link 
          href="/admin/categories" 
          className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
        >
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHero
        title="Editar Categoría"
        subtitle={`Modifica los datos de la categoría ${category.name}.`}
        actions={
          <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <CategoryForm initialData={category} />
      </div>
    </div>
  );
}
