'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const slides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1932&q=80',
    title: 'Vende con SafeEasy',
    description: 'Amplíe su negocio y globalícese con una membresía',
    buttonText: 'Empieza a vender ahora',
    link: '#plans',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1974&q=80',
    title: 'MÁS CANALES DE VENTA ONLINE',
    description: 'Llegar a nuevos mercados nunca fue tan fácil',
    buttonText: 'Ver Planes',
    link: '#plans',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
    title: 'Conecte con Compradores',
    description: 'Los compradores pueden encontrarlo a través de la búsqueda y enviar consultas directamente',
    buttonText: 'Registrarse',
    link: '#plans',
  },
];

export default function SellHero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-[600px] w-full overflow-hidden bg-gray-900">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute inset-0 bg-black/50 z-10" />
          <img
            src={slide.image}
            alt={slide.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-4xl animate-fade-in-up">
              {slide.title}
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl animate-fade-in-up delay-100">
              {slide.description}
            </p>
            <Link
              href={slide.link}
              className="bg-primary hover:bg-primary/90 text-white font-bold py-4 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg animate-fade-in-up delay-200"
            >
              {slide.buttonText}
            </Link>
          </div>
        </div>
      ))}

      {/* Indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === currentSlide ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
