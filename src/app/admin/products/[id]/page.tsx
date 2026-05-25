"use client";

import { useState, useEffect } from "react";
import ProductForm from "@/components/admin/ProductForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  category_id: number;
  subcategory_id: number;
  slug: string;
  thumbnail_url?: string;
}

export default function EditProductPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!token || !id) return;
      
      try {
        // Try to fetch specific product first
        const response = await fetchWithAuth(`/api/products/${id}/`);
        
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        } else {
            console.warn(`Direct fetch failed (${response.status}), trying fallback via list...`);
            
            // Fallback: Fetch list and find product
            // This is useful if GET /products/{id} is not implemented (405)
            const listResponse = await fetchWithAuth(`/api/products/?skip=0&limit=1000`);

            if (listResponse.ok) {
                const listData = await listResponse.json();
                const found = Array.isArray(listData) 
                    ? listData.find((p: Product) => String(p.id) === String(id))
                    : null;
                
                if (found) {
                    setProduct(found);
                    return;
                } else {
                    console.warn(`Product ${id} not found in fallback list (checked ${listData.length} items)`);
                }
            } else {
                console.warn(`Fallback list fetch failed: ${listResponse.status}`);
            }

            // If we are here, both direct and fallback failed.
            // We don't use console.error to avoid Next.js overlay for expected API limitations
            const text = await response.text();
            console.warn("Direct fetch error response:", text); 
            
            // Set a user-friendly error
            setError(`No se pudo cargar el producto. El servidor no permite acceso directo (405) y no se encontró en el listado.`);
        }
      } catch (err: any) {
        console.error(err);
        setError(`Connection error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Producto no encontrado"}</p>
        <Link href="/admin/products" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Producto"
        subtitle={`Modifica los datos del producto ${product.title}.`}
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <ProductForm initialData={product} isEditMode={true} />
    </div>
  );
}
