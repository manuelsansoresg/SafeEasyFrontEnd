"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Supplier } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SupplierPage() {
  const { slug } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inicio");

  useEffect(() => {
    if (slug) {
      fetchSupplier(slug as string);
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

  const sanitizeHtml = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
      .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
      .replace(/on\w+="[^"]*"/gim, "")
      .replace(/on\w+='[^']*'/gim, "")
      .replace(/javascript:/gim, "");
  };

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
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 relative shrink-0 bg-white border rounded-xl overflow-hidden shadow-sm">
            {supplier.logo ? (
              <img src={supplier.logo} alt={supplier.name} className="w-full h-full object-contain p-2" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                <Store size={48} />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-3">
              {supplier.name}
              {supplier.certificates && supplier.certificates.length > 0 && (
                <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                  <CheckCircle size={16} />
                  <span>Certificado</span>
                </div>
              )}
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl">
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
        </div>

        <div className="border-t bg-white">
          <div className="container mx-auto px-4">
            <nav className="flex justify-center md:justify-start overflow-x-auto">
              {["inicio", "nosotros", "contacto"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-4 font-medium transition-all relative whitespace-nowrap ${
                    activeTab === tab ? "text-primary" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "inicio" && (
              <div className="space-y-8">
                {supplier.carousel_images && supplier.carousel_images.length > 0 && (
                  <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden relative shadow-md bg-gray-900 group">
                    <Carousel images={supplier.carousel_images} />
                  </div>
                )}

                {supplier.description && (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 text-gray-900 border-b pb-4">Descripción de la Empresa</h2>
                    <div
                      className="prose prose-lg max-w-none text-gray-600 prose-headings:text-gray-800 prose-a:text-primary"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(supplier.description) }}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "nosotros" && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Sobre Nosotros</h2>
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  {supplier.about_image && (
                    <div className="w-full lg:w-1/2 rounded-xl overflow-hidden shadow-md">
                      <img src={supplier.about_image} alt="Acerca de nosotros" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="prose max-w-none text-gray-600">
                      {supplier.about ? (
                        <p className="whitespace-pre-wrap">{supplier.about}</p>
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
                </div>
              </div>
            )}

            {activeTab === "contacto" && (
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
            )}
          </motion.div>
        </AnimatePresence>
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
