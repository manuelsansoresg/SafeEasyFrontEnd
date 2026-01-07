"use client";

import { useState, useEffect } from "react";
import ProductForm from "@/components/admin/ProductForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

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
        const response = await fetch(`/api/products/${id}/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        } else {
            console.warn(`Direct fetch failed (${response.status}), trying fallback via list...`);
            
            // Fallback: Fetch list and find product
            // This is useful if GET /products/{id} is not implemented (405)
            const listResponse = await fetch(`/api/products/?skip=0&limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

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
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/products" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Editar Producto</h1>
          <p className="text-gray-500 mt-1">Modifica los datos del producto {product.title}.</p>
        </div>
      </div>

      <ProductForm initialData={product} isEditMode={true} />
    </div>
  );
}
