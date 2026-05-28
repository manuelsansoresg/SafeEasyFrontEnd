"use client";

import { useState, useEffect } from "react";
import SubcategoryForm from "@/components/admin/SubcategoryForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  is_active: boolean;
  slug: string;
  image: string | null;
}

export default function EditSubcategoryPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubcategory = async () => {
      if (!token || !id) return;
      
      try {
        const response = await fetchWithAuth(`/api/subcategories/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setSubcategory(data);
        } else {
            // Fallback: fetch all subcategories and find by id
            console.warn(`Direct fetch failed (${response.status}). Trying fallback list fetch...`);
            const listResponse = await fetchWithAuth(`/api/subcategories/`);
            if (listResponse.ok) {
                const listData = await listResponse.json();
                // Ensure ID comparison is type-safe (string vs number)
                const found = listData.find((item: Subcategory) => String(item.id) === String(id));
                if (found) {
                    setSubcategory(found);
                } else {
                    setError("Subcategoría no encontrada en el listado");
                }
            } else {
                setError("No se pudo cargar la subcategoría");
            }
        }
      } catch (err: any) {
        console.error("Error fetching subcategory:", err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchSubcategory();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p>Cargando información de la subcategoría...</p>
      </div>
    );
  }

  if (error || !subcategory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h2 className="text-xl font-bold text-gray-800">Error</h2>
        <p className="text-gray-500">{error || "Subcategoría no encontrada"}</p>
        <Link 
          href="/admin/subcategories" 
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
        title="Editar Subcategoría"
        subtitle={`Modifica los datos de la subcategoría ${subcategory.name}.`}
        eyebrow="Contenido"
        actions={
          <Link href="/admin/subcategories" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <SubcategoryForm initialData={subcategory} />
      </div>
    </div>
  );
}
