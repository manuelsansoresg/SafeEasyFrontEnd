"use client";

import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Mendoza",
    role: "Director General, TechSolutions MX",
    image: null, // Placeholder or use initials
    content: "Desde que nos unimos a Drooopy, nuestras ventas han aumentado un 45% en el primer trimestre. La plataforma nos permite compartir nuestro catálogo digital de forma profesional y cerrar tratos más rápido.",
    rating: 5
  },
  {
    name: "Ana Lucía Torres",
    role: "Gerente de Ventas, Textiles del Norte",
    image: null,
    content: "Lo que más me gusta es tener mi propio espacio personalizado. Puedo enviar un enlace directo a mis clientes y ellos ven todos mis productos organizados. Es como tener mi propia web pero con el respaldo de Drooopy.",
    rating: 5
  },
  {
    name: "Roberto Sánchez",
    role: "Fundador, Importadora Global",
    image: null,
    content: "La verificación de empresa nos dio la credibilidad que nos faltaba para atraer clientes internacionales. Tener todo a la mano en el panel administrativo facilita muchísimo la gestión diaria.",
    rating: 4.5
  }
];

export default function SellTestimonials() {
  return (
    <section className="py-20 bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Historias de éxito de nuestros vendedores
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Descubra cómo empresas como la suya están creciendo y simplificando sus operaciones con Drooopy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative hover:shadow-md transition-shadow duration-300"
            >
              <Quote className="absolute top-6 right-6 text-primary/10 w-12 h-12" />
              
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    size={18} 
                    className={`${i < Math.floor(testimonial.rating) ? "fill-primary text-primary" : "text-gray-200"}`} 
                  />
                ))}
              </div>

              <p className="text-gray-700 text-lg mb-8 leading-relaxed italic">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
