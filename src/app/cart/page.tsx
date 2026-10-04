"use client";

import Link from "next/link";
import { MenuCartSection } from "@/components/cart/MenuCartSection";
import ProductCartSection from "@/components/cart/ProductCartSection";
import { PageHero } from "@/components/ui/PageHero";
import { getLoginUrl } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/useAuthStore";

export default function CartPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="space-y-8 font-[family-name:var(--font-poppins)]">
      <PageHero title="Tu carrito" subtitle="Revisa tus compras por tienda y tus pedidos de Menú por restaurante." />
      {isAuthenticated ? <ProductCartSection /> : (
        <section aria-labelledby="product-cart-heading" className="space-y-4">
          <h2 id="product-cart-heading" className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">Productos</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            <p>Inicia sesión para consultar tu carrito de productos.</p>
            <Link href={getLoginUrl("/cart")} className="mt-4 inline-flex rounded-xl bg-[#168e00] px-4 py-2.5 font-bold text-white">Iniciar sesión</Link>
          </div>
        </section>
      )}
      <MenuCartSection />
    </div>
  );
}
