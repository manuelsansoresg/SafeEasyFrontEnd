import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { Product } from '@/lib/products';
import { ProductCard } from '@/components/ProductCard';

interface SimilarProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  baseProductTitle: string;
  loading: boolean;
}

export default function SimilarProductsModal({
  isOpen,
  onClose,
  products,
  baseProductTitle,
  loading,
}: SimilarProductsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Productos Similares</h3>
            <p className="text-sm text-gray-500 mt-1">
              Porque viste <span className="font-medium text-gray-800">"{baseProductTitle}"</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-gray-500">Buscando productos relacionados...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={String(product.id)}
                  title={product.title}
                  price={product.price}
                  image={product.thumbnail_url || ""}
                  minOrder="1 pieza"
                  slug={product.slug}
                  rating={Number(product.average_rating || 0)}
                  supplier={product.supplier}
                  // When clicking a similar product, we let it navigate normally to the product page
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No encontramos productos similares en este momento.</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
                Cerrar
            </button>
        </div>
      </div>
    </div>
  );
}
