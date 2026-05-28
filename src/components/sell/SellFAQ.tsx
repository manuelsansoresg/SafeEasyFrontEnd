"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "¿Necesito una tarjeta de crédito para registrarme?",
    answer: "No, puede comenzar con nuestro plan Básico totalmente gratuito sin necesidad de ingresar datos bancarios. Solo requerimos información de pago si decide actualizar a nuestros planes Profesional o Empresarial."
  },
  {
    question: "¿Cómo funciona la verificación de empresa?",
    answer: "Para aumentar la confianza de los compradores, ofrecemos un distintivo de 'Empresa Verificada'. Puede solicitarlo subiendo documentos oficiales (como acta constitutiva o identificación fiscal) desde su panel de control. Nuestro equipo revisará la información en menos de 48 horas."
  },
  {
    question: "¿Puedo compartir mi tienda con clientes fuera de Drooopy?",
    answer: "¡Sí! Al registrarse obtiene una URL personalizada (ej. drooopy.com/mi-empresa) que funciona como su propio sitio web. Puede compartir este enlace en sus redes sociales, correos o WhatsApp para que sus clientes vean su catálogo completo."
  },
  {
    question: "¿Hay comisiones por venta?",
    answer: "Drooopy opera principalmente bajo un modelo de suscripción. El plan Básico tiene una pequeña comisión por transacción para mantener la plataforma. Los planes Profesional y Empresarial disfrutan de 0% de comisión por venta, permitiéndole maximizar sus ganancias."
  },
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer: "Absolutamente. Puede actualizar o degradar su plan en cualquier momento desde su panel de administración. Los cambios de actualización son inmediatos, y las cancelaciones se aplican al final del ciclo de facturación actual."
  }
];

export default function SellFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-xl text-gray-600">
            Resolvemos sus dudas para que pueda comenzar a vender con confianza.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`border rounded-2xl transition-all duration-300 ${
                openIndex === index ? "border-primary/30 bg-primary/5" : "border-gray-200 hover:border-primary/20"
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className={`text-lg font-bold ${openIndex === index ? "text-primary" : "text-gray-800"}`}>
                  {faq.question}
                </span>
                <span className={`ml-4 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  openIndex === index ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {openIndex === index ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-0 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
