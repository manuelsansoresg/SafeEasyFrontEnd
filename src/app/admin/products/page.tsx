"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Package,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

export default function AdminProductsPage() {
  const { token } = useAuthStore();
  
  // -- State --
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search
  const [search, setSearch] = useState("");

  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  
  // -- Effects --

  useEffect(() => {
    fetchProducts();
  }, [skip, limit, token]); // Removed search from dependency array to avoid auto-fetch on every keystroke if we want manual or debounced. 
  // However, for simplicity and UX, often debounce is better. 
  // Let's stick to manual search or debounced. 
  // User didn't specify, but I'll add a search handler or just put it in the dependency if I use a debounce.
  // For now, I'll add a separate useEffect for search with a timeout or just update the fetch function.
  
  // Actually, let's keep it simple: Fetch when search changes? 
  // Or maybe add a "Search" button or just 'Enter' key?
  // I will add 'search' to the fetchProducts call and maybe trigger it on enter or blur.
  // But wait, if I change 'search' state, I want to re-fetch.
  // Let's use a debounced effect for search.

  useEffect(() => {
    const timer = setTimeout(() => {
        setSkip(0); // Reset pagination on search
        fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]); // Trigger on search change

  // -- API Calls --

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      if (search) {
        queryParams.append('search', search);
      }
      
      const response = await fetchWithAuth(`/api/products/?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    if (!token) return;
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchProducts();
      } else {
        alert("Error al eliminar producto");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
          <p className="text-gray-500 mt-1">Gestión del catálogo de productos</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
            </div>
            
            <Link 
              href="/admin/products/create"
              className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 shrink-0"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Nuevo Producto</span>
            </Link>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 font-semibold text-gray-600 text-sm w-[80px]">Imagen</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm min-w-[200px]">Nombre</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">SKU</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Precio</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Stock</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-center">Estado</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No hay productos registrados.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                          {product.thumbnail_url ? (
                            <img 
                              src={product.thumbnail_url} 
                              alt={product.title} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="text-gray-300" size={24} />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{product.title}</div>
                        <div 
                          className="text-xs text-gray-400 truncate max-w-[200px]" 
                          dangerouslySetInnerHTML={{ __html: product.description.substring(0, 100) + (product.description.length > 100 ? '...' : '') }} 
                        />
                      </td>
                      <td className="p-4 text-sm text-gray-600">{product.sku}</td>
                      <td className="p-4 text-sm font-medium text-gray-800">${product.price}</td>
                      <td className="p-4 text-sm text-gray-600">{product.stock}</td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          product.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        )}>
                          {product.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/admin/products/${product.id}`}
                            className="cursor-pointer p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </Link>
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="cursor-pointer p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Simple Pagination Controls */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center">
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Mostrando {skip + 1} - {skip + products.length}
          </span>
          <button
            disabled={products.length < limit}
            onClick={() => setSkip(skip + limit)}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
