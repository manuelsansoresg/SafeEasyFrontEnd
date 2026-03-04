import Link from "next/link";
import Image from "next/image";
import { MessageSquare } from "lucide-react";

export function HomeBusinessSupport() {
  return (
    <section className="bg-[#f9f9f9] py-16 md:py-24 overflow-hidden relative">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
          
          {/* Left: Image Container */}
          <div className="w-full md:w-1/2 relative">
             {/* Main Image Mask */}
             <div className="relative aspect-[4/3] rounded-[3rem] rounded-tl-[6rem] overflow-hidden shadow-2xl z-10 bg-gray-200">
                <Image 
                  src="/business-support-team.png" 
                  alt="Equipo trabajando juntos" 
                  fill 
                  className="object-cover"
                />
                
                {/* Floating Chat Icon */}
                <div className="absolute bottom-6 left-6 bg-[#004e28] p-4 rounded-full shadow-lg">
                    <MessageSquare className="text-white w-8 h-8" fill="currentColor" />
                </div>
             </div>
          </div>

          {/* Right: Content */}
          <div className="w-full md:w-1/2 space-y-6 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)] leading-tight">
              Hagamos que tu <br className="hidden md:block"/> negocio tenga éxito.
            </h2>
            
            <div className="space-y-6 text-gray-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto md:mx-0">
              <p>
                Somos una empresa Mexicana que apoya a los negocios locales a promocionar sus productos y servicios desde nuestra página web.
              </p>
              <p>
                Aqui encontrarás una amplia variedad de recursos diseñados para impulsar tu marca al siguiente nivel. Además, nuestro equipo de expertos está comprometido a brindarte un servicio excepcional y resultados tangibles. Únete a nosotros y descubre cómo podemos ayudarte a crecer y destacar en el mercado local.
              </p>
            </div>

            <div className="pt-4">
                <Link 
                href="/nosotros" 
                className="inline-block bg-[#7ed957] hover:bg-[#6cc54a] text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-md text-lg"
                >
                Conoce más de nosotros
                </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
