"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Supplier } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Store, Star, Check, MessageCircle } from "lucide-react";
import StarRating from "@/components/StarRating";
import { ProductCard } from "@/components/ProductCard";

interface SupplierProductCategory {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  is_active: boolean;
  slug: string;
}

interface SupplierProductSubcategory {
  id: number;
  name: string;
  category_id: number;
  is_active: boolean;
  slug: string;
  image: string | null;
  thumbnail_url: string | null;
}

interface SupplierProduct {
  id: number;
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
  average_rating?: number;
  thumbnail_url?: string | null;
  category?: SupplierProductCategory;
  subcategory?: SupplierProductSubcategory;
}

interface SupplierRating {
  id: number;
  rating: number;
  comment: string;
  user_name: string | null;
  product_id: string;
  product_title: string;
  product_slug: string;
  product_image?: string | null;
  product_thumbnail_url?: string | null;
  created_at?: string;
}

interface SupplierRatingsResponse {
  supplier_slug: string;
  total: number;
  skip: number;
  limit: number;
  ratings: SupplierRating[];
}

export default function SupplierPage() {
  const { slug } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inicio");
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(null);
  const [ratings, setRatings] = useState<SupplierRating[]>([]);
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [ratingsSkip, setRatingsSkip] = useState(0);
  const ratingsLimit = 50;
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoadingMore, setRatingsLoadingMore] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsHasMore, setRatingsHasMore] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchSupplier(slug as string);
      setPage(1);
      setSelectedCategorySlug(null);
      setSelectedSubcategorySlug(null);
      fetchProducts(slug as string, 1);
      fetchRatings(slug as string, 0, false);
    }
  }, [slug]);

  const fetchSupplier = async (slug: string) => {
    try {
      const res = await fetch(`/api/suppliers/${slug}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSupplier(data);
      }
    } catch (error) {
      console.error("Error fetching supplier", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (supplierSlug: string, currentPage: number) => {
    try {
      setProductsLoading(true);
      setProductsError(null);

      const skip = (currentPage - 1) * limit;
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(limit));

      const res = await fetch(`/api/products/by-supplier/${supplierSlug}?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Error fetching supplier products", res.status, res.statusText);
        setProducts([]);
        setHasMore(false);
        setProductsError("No fue posible cargar los productos.");
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || data.results || []);

      setProducts(items as SupplierProduct[]);
      setHasMore(Array.isArray(items) && items.length === limit);
    } catch (error) {
      console.error("Error fetching supplier products", error);
      setProductsError("Ocurrió un error al cargar los productos.");
      setProducts([]);
      setHasMore(false);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchRatings = async (supplierSlug: string, skip: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setRatingsLoadingMore(true);
      } else {
        setRatingsLoading(true);
      }
      setRatingsError(null);

      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(ratingsLimit));

      const res = await fetch(`/api/suppliers/${supplierSlug}/ratings?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error fetching supplier ratings", res.status, res.statusText, text);
        setRatings([]);
        setRatingsTotal(0);
        setRatingsSkip(0);
        setRatingsHasMore(false);
        setRatingsError("No fue posible cargar las calificaciones.");
        return;
      }

      const data = (await res.json()) as SupplierRatingsResponse | { ratings?: SupplierRating[]; total?: number; skip?: number; limit?: number };
      const ratingsList = Array.isArray((data as SupplierRatingsResponse).ratings)
        ? (data as SupplierRatingsResponse).ratings
        : Array.isArray((data as any).ratings)
        ? (data as any).ratings
        : [];

      const total = typeof (data as SupplierRatingsResponse).total === "number" ? (data as SupplierRatingsResponse).total : ratingsList.length;
      const responseSkip = typeof (data as SupplierRatingsResponse).skip === "number" ? (data as SupplierRatingsResponse).skip : skip;
      const responseLimit = typeof (data as SupplierRatingsResponse).limit === "number" ? (data as SupplierRatingsResponse).limit : ratingsLimit;

      setRatings((prev) => {
        const next = append ? [...prev, ...ratingsList] : ratingsList;
        const hasMore = total > next.length && ratingsList.length >= responseLimit;
        setRatingsHasMore(hasMore);
        return next;
      });

      setRatingsTotal(total);
      setRatingsSkip(responseSkip);
    } catch (error) {
      console.error("Error fetching supplier ratings", error);
      setRatings([]);
      setRatingsTotal(0);
      setRatingsSkip(0);
      setRatingsHasMore(false);
      setRatingsError("Ocurrió un error al cargar las calificaciones.");
    } finally {
      setRatingsLoading(false);
      setRatingsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    if (page === 1) return;
    fetchProducts(slug as string, page);
  }, [page, slug]);

  const handleScroll = (sectionId: string) => {
    setActiveTab(sectionId);
    const element = document.getElementById(sectionId);
    if (!element) return;

    const headerOffset = 140;
    const elementPosition = element.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = elementPosition - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  };

  const sanitizeHtml = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
      .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
      .replace(/on\w+="[^"]*"/gim, "")
      .replace(/on\w+='[^']*'/gim, "")
      .replace(/javascript:/gim, "")
      .replace(/&nbsp;/gi, " ");
  };

  const categories = (() => {
    const map = new Map<string, SupplierProductCategory>();
    products.forEach((product) => {
      if (product.category) {
        map.set(product.category.slug, product.category);
      }
    });
    return Array.from(map.values());
  })();

  const subcategories = (() => {
    const map = new Map<string, SupplierProductSubcategory>();
    products.forEach((product) => {
      if (
        product.subcategory &&
        (!selectedCategorySlug || product.category?.slug === selectedCategorySlug)
      ) {
        map.set(product.subcategory.slug, product.subcategory);
      }
    });
    return Array.from(map.values());
  })();

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return "Excelente";
    if (rating >= 4.0) return "Muy Bueno";
    if (rating >= 3.0) return "Bueno";
    if (rating >= 2.0) return "Regular";
    return "Malo";
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategorySlug ? product.category?.slug === selectedCategorySlug : true;
    const matchesSubcategory = selectedSubcategorySlug ? product.subcategory?.slug === selectedSubcategorySlug : true;
    return matchesCategory && matchesSubcategory;
  });

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );

  if (!supplier)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Empresa no encontrada</h2>
          <p className="text-gray-500">No pudimos encontrar la empresa que buscas.</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b md:sticky md:top-0 md:z-50">
        <div className="container mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 relative shrink-0 bg-white border rounded-xl overflow-hidden shadow-sm">
            {supplier.logo ? (
              <img src={supplier.logo} alt={supplier.name} className="w-full h-full object-contain p-2" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                <Store size={40} />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  {supplier.name}
                  {supplier.certificates && supplier.certificates.length > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                      <CheckCircle size={14} />
                      <span>Certificado</span>
                    </div>
                  )}
                </h1>
                <p className="text-gray-600 text-base md:text-lg max-w-2xl mt-1">
                  {supplier.short_description || "Empresa destacada en SafeEasy"}
                </p>
                
                {supplier.city && supplier.country && (
                  <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 text-sm mt-2">
                    <MapPin size={16} />
                    <span>
                      {supplier.city}, {supplier.state}, {supplier.country}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center md:items-end bg-gray-50 p-3 rounded-lg border border-gray-100 min-w-[160px]">
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {supplier.average_rating ? supplier.average_rating.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-gray-400 text-sm font-medium">/5</span>
                  </div>
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="font-semibold text-gray-900 text-sm">
                  {supplier.average_rating ? getRatingLabel(supplier.average_rating) : "Sin calificaciones"}
                </div>
                <div className="text-primary text-xs hover:underline cursor-pointer mt-0.5">
                  {supplier.rating_count || 0} calificaciones
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block border-t bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <nav className="flex justify-start overflow-x-auto gap-2 md:gap-3 py-2 md:py-3">
              {[
                { id: "inicio", label: "Inicio" },
                { id: "productos", label: "Productos" },
                { id: "calificaciones", label: "Calificaciones" },
                { id: "nosotros", label: "Nosotros" },
                { id: "contacto", label: "Contacto" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleScroll(item.id)}
                  className={`px-6 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
                    activeTab === item.id
                      ? "bg-primary text-white shadow-md transform scale-105"
                      : "bg-white/60 text-primary hover:bg-white hover:shadow-sm"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 space-y-16 overflow-x-hidden">
        <section id="inicio" className="space-y-8 scroll-mt-32">
          {supplier.carousel_images && supplier.carousel_images.length > 0 && (
            <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden relative shadow-md bg-gray-900 group">
              <Carousel images={supplier.carousel_images} />
            </div>
          )}

          {supplier.description && (
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 text-gray-900 border-b pb-4">Descripción de la Empresa</h2>
              <div className="prose prose-lg max-w-none w-full text-gray-600 prose-headings:text-gray-800 prose-a:text-primary">
                <div
                  className="whitespace-normal max-w-full description-html"
                  style={{ 
                    textAlign: "left", 
                    wordBreak: "normal", 
                    overflowWrap: "normal",
                    hyphens: "none",
                    WebkitHyphens: "none"
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(supplier.description) }}
                />
              </div>
            </div>
          )}
        </section>

        <section id="productos" className="scroll-mt-32">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
                <p className="text-gray-500 text-sm md:text-base">
                  Explora los productos que ofrece {supplier.name}.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Categorías
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategorySlug(null);
                    setSelectedSubcategorySlug(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    !selectedCategorySlug
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                  }`}
                >
                  Todas
                </button>
                {categories.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => {
                      setSelectedCategorySlug(category.slug);
                      setSelectedSubcategorySlug(null);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedCategorySlug === category.slug
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {selectedCategorySlug && subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Subcategorías
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategorySlug(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      !selectedSubcategorySlug
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    Todas
                  </button>
                  {subcategories.map((subcategory) => (
                    <button
                      key={subcategory.slug}
                      type="button"
                      onClick={() => setSelectedSubcategorySlug(subcategory.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedSubcategorySlug === subcategory.slug
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      {subcategory.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Cargando productos...</span>
                </div>
              </div>
            ) : productsError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {productsError}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No se encontraron productos para esta empresa.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={String(product.id)}
                      title={product.title}
                      price={product.price}
                      image={product.thumbnail_url || ""}
                      minOrder="1 pieza"
                      slug={product.slug}
                      rating={Number(product.average_rating || 0)}
                      supplier={supplier}
                    />
                  ))}
                </div>

                <div className="flex justify-center items-center gap-4 mt-8">
                  <button
                    type="button"
                    disabled={page === 1 || productsLoading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      page === 1 || productsLoading
                        ? "text-gray-300 border-gray-200 cursor-not-allowed"
                        : "text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  <span className="text-sm text-gray-600 font-medium">
                    Página {page}
                  </span>

                  <button
                    type="button"
                    disabled={!hasMore || productsLoading}
                    onClick={() => setPage((prev) => prev + 1)}
                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      !hasMore || productsLoading
                        ? "text-gray-300 border-gray-200 cursor-not-allowed"
                        : "text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section id="calificaciones" className="scroll-mt-32">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Calificaciones</h2>
                <p className="text-gray-500 text-sm md:text-base">
                  Opiniones de compradores sobre {supplier.name}.
                </p>
              </div>
              <div className="flex flex-col items-center bg-gray-50 p-4 rounded-xl border border-gray-100 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <StarRating rating={Number(supplier.average_rating || 0)} size={18} />
                  <span className="text-xs text-gray-500 font-medium">/5</span>
                </div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  {supplier.average_rating ? supplier.average_rating.toFixed(1) : "0.0"}
                </div>
                <div className="text-sm font-semibold text-gray-800">
                  {supplier.average_rating ? getRatingLabel(supplier.average_rating) : "Sin calificaciones"}
                </div>
                <div className="text-primary text-xs mt-1">
                  {supplier.rating_count || 0} calificaciones
                </div>
              </div>
            </div>

            {ratingsLoading && ratings.length === 0 ? (
              <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Cargando calificaciones...</span>
                </div>
              </div>
            ) : ratingsError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {ratingsError}
              </div>
            ) : ratings.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-900 font-medium">Aún no hay calificaciones para este proveedor.</p>
                <p className="text-sm text-gray-500">Cuando los compradores dejen su opinión, aparecerá aquí.</p>
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="border-b border-gray-100 pb-8 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 uppercase">
                            {rating.user_name ? rating.user_name[0] : "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">
                                {rating.user_name || "Usuario"}
                              </span>
                             
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StarRating rating={rating.rating} size={14} />
                              <span className="text-xs text-gray-400 font-medium">
                                {rating.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {rating.created_at && (
                          <span className="text-xs text-gray-400 font-medium">
                            {new Date(rating.created_at).toLocaleDateString("es-MX", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-[52px] mb-4">{rating.comment}</p>
                      <div className="pl-[52px]">
                        <Link
                          href={`/product/${rating.product_slug}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                            {rating.product_thumbnail_url || rating.product_image ? (
                              <img
                                src={rating.product_thumbnail_url || rating.product_image || ""}
                                alt={rating.product_title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                                <Store size={24} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {rating.product_title}
                            </p>
                          </div>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {ratingsHasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      type="button"
                      disabled={ratingsLoadingMore}
                      onClick={() => {
                        if (slug) {
                          fetchRatings(slug as string, ratingsSkip + ratingsLimit, true);
                        }
                      }}
                      className="px-6 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ratingsLoadingMore ? "Cargando más..." : "Ver más calificaciones"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section id="nosotros" className="scroll-mt-32">
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Sobre Nosotros</h2>

            {supplier.about_image && (
              <div className="w-full mb-6 rounded-xl overflow-hidden shadow-md">
                <img src={supplier.about_image} alt="Acerca de nosotros" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="prose prose-lg max-w-none w-full text-gray-600">
              {supplier.about ? (
                <div
                  className="whitespace-normal max-w-full about-html"
                  style={{ 
                    textAlign: "left", 
                    wordBreak: "normal", 
                    overflowWrap: "normal",
                    hyphens: "none",
                    WebkitHyphens: "none"
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(supplier.about),
                  }}
                />
              ) : (
                <p className="italic text-gray-400">Información detallada no disponible.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-1">Año de Registro</h3>
                <p className="text-gray-600">2023</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-1">Tipo de Negocio</h3>
                <p className="text-gray-600">Fabricante / Distribuidor</p>
              </div>
            </div>
          </div>
        </section>

        <section id="contacto" className="scroll-mt-32">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 text-gray-900">Información de Contacto</h2>
                <div className="space-y-6">
                  {supplier.address && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Dirección</p>
                        <p className="text-gray-600 mt-1">
                          {supplier.address} {supplier.exterior_number} {supplier.interior_number}
                        </p>
                        <p className="text-gray-600">{supplier.neighborhood}</p>
                        <p className="text-gray-600">
                          {supplier.city}, {supplier.state}, {supplier.country}
                        </p>
                      </div>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Teléfono</p>
                        <p className="text-gray-600 mt-1">{supplier.phone}</p>
                      </div>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Correo Electrónico</p>
                        <p className="text-gray-600 mt-1">{supplier.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-4">¿Tienes preguntas?</h2>
                  <p className="mb-6 opacity-90">
                    Contáctanos directamente para obtener más información sobre nuestros productos y servicios.
                  </p>

                  <button className="w-full py-3 bg-white text-primary font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm">
                    Enviar Mensaje
                  </button>
                </div>

                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Carousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const nextSlide = () => setCurrent((c) => (c + 1) % images.length);
  const prevSlide = () => setCurrent((c) => (c - 1 + images.length) % images.length);

  return (
    <div className="relative w-full h-full">
      {images.map((src, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <img src={src} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        </div>
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={24} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === current ? "bg-white w-6" : "bg-white/50 hover:bg-white/80"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrent(idx);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
