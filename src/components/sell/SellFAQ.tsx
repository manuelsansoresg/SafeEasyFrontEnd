"use client";

import { useEffect, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sellFaqService, type SellFaq } from "@/services/sellFaqService";

export default function SellFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<SellFaq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadFaqs = async () => {
      try {
        const data = await sellFaqService.listActive();
        if (!mounted) return;
        setFaqs(data);
        setOpenIndex(data.length > 0 ? 0 : null);
      } catch (error) {
        console.error("No se pudieron cargar las preguntas de venta:", error);
        if (!mounted) return;
        setFaqs([]);
        setOpenIndex(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadFaqs();
    return () => {
      mounted = false;
    };
  }, []);

  const renderHeader = () => (
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
        Preguntas Frecuentes
      </h2>
      <p className="text-xl text-gray-600">
        Resolvemos sus dudas para que pueda comenzar a vender con confianza.
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          {renderHeader()}
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 rounded-2xl border border-gray-200 bg-gray-50 animate-pulse mb-4" />
          ))}
        </div>
      </section>
    );
  }

  if (faqs.length === 0) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          {renderHeader()}
          <div className="text-center py-12 text-gray-500">
            <p>No hay preguntas disponibles en este momento.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        {renderHeader()}

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={faq.id} 
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
