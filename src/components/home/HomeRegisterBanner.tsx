import Link from "next/link";

export function HomeRegisterBanner() {
  return (
    <section className="w-full py-16 md:py-24 bg-[#104528]">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <h2 className="text-3xl md:text-5xl font-bold text-white font-[family-name:var(--font-varela-round)] text-center md:text-left leading-tight">
            Registra tu empresa en Drooopy.com
          </h2>
          
          <Link 
            href="/register" 
            className="inline-block bg-[#7ed957] hover:bg-[#6cc54a] text-white font-bold text-xl md:text-2xl px-12 py-4 rounded-full transition-all transform hover:scale-105 shadow-lg whitespace-nowrap"
          >
            Regístrate aquí
          </Link>
        </div>
      </div>
    </section>
  );
}
