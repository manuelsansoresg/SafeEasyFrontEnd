"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Search, User, ChevronDown, ShoppingBag, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { registerInteraction } from "@/lib/interactions";

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      registerInteraction({
        search_term: query,
        interaction_type: 'search'
      });
      router.push(`/?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/");
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full flex items-center">
      <input
        type="text"
        placeholder="¿Qué estás buscando?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-10 pl-4 pr-32 rounded-full border-2 border-primary/50 focus:border-primary focus:outline-none transition-colors"
      />
      <button type="submit" className="absolute right-0 top-0 bottom-0 px-6 bg-primary text-primary-foreground rounded-r-full font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
        <Search size={18} />
        Buscar
      </button>
    </form>
  );
}

function MobileSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/");
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full flex items-center">
      <input
        type="text"
        placeholder="Buscar..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-9 pl-3 pr-10 rounded-full border border-border bg-secondary focus:border-primary focus:outline-none text-sm"
      />
      <button type="submit" className="absolute right-3 p-1 text-muted-foreground">
        <Search size={16} />
      </button>
    </form>
  );
}

import { MessagesDropdown } from "@/components/chat/MessagesDropdown";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const pathname = usePathname();
  const isSupplierPage = pathname?.startsWith('/empresas/');

  const handleSupplierScroll = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300",
        isScrolled ? "shadow-md" : "border-b border-border"
      )}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <span className="text-2xl font-bold text-primary tracking-tight">
            SafeEasy
          </span>
        </Link>

        {/* Search Bar - Hidden on very small screens if needed, or adapted */}
        {!isSupplierPage ? (
          <div className="flex-1 max-w-2xl mx-4 hidden md:flex relative group">
            <Suspense fallback={<div className="w-full h-10 bg-gray-100 rounded-full" />}>
              <SearchBar />
            </Suspense>
          </div>
        ) : (
          <nav className="hidden md:flex flex-1 items-center justify-center mx-6">
            <div className="flex items-center gap-1 bg-gray-100/80 p-1.5 rounded-full border border-gray-200/60 shadow-sm backdrop-blur-sm">
              {[
                { id: "inicio", label: "Inicio" },
                { id: "productos", label: "Productos" },
                { id: "certificados", label: "Certificados" },
                { id: "calificaciones", label: "Calificaciones" },
                { id: "nosotros", label: "Nosotros" },
                { id: "contacto", label: "Contacto" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSupplierScroll(item.id)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 rounded-full hover:bg-white hover:text-primary hover:shadow-sm transition-all duration-200 whitespace-nowrap"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Mobile Search - Simplified */}
        {!isSupplierPage && (
          <div className="flex-1 md:hidden mx-2">
             <Suspense fallback={<div className="w-full h-9 bg-gray-100 rounded-full" />}>
               <MobileSearchBar />
             </Suspense>
          </div>
        )}

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-6">
          {!isSupplierPage && (
            <Link
              href="/sell"
              className="flex items-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 py-2 px-4 rounded-full transition-all shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <ShoppingBag size={18} />
              <span>Vende en SafeEasy</span>
            </Link>
          )}

          {/* Messages Dropdown */}
          {isAuthenticated && <MessagesDropdown />}

          {/* User Menu */}
          <div
            className="relative"
            onMouseEnter={() => setIsUserMenuOpen(true)}
            onMouseLeave={() => setIsUserMenuOpen(false)}
          >
            {isAuthenticated ? (
              <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors py-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs text-muted-foreground">
                    Hola, {user?.name}
                  </span>
                  <span className="flex items-center gap-1 font-bold">
                    Mi Cuenta <ChevronDown size={14} />
                  </span>
                </div>
              </button>
            ) : (
              <Link href="/login" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors py-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs text-muted-foreground">Hola, Inicia sesión</span>
                  <span className="font-bold">Inicia sesión</span>
                </div>
              </Link>
            )}

            <AnimatePresence>
              {isUserMenuOpen && isAuthenticated && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full w-64 bg-white rounded-xl shadow-xl border border-border overflow-hidden py-2"
                >
                  <div className="px-4 py-3 border-b border-border bg-secondary/30">
                    <p className="font-semibold text-sm">Tu cuenta</p>
                  </div>
                  <nav className="flex flex-col">
                    {(user?.role === 'admin' || user?.role === 'supplier') && (
                      <Link href="/admin/dashboard" className="px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3 font-medium text-primary">
                        <span>🛡️</span> {user.role === 'admin' ? 'Panel Admin' : 'Mi Empresa'}
                      </Link>
                    )}
                    {user?.role === 'client' && (
                      <Link href="/client/profile" className="px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3 font-medium text-primary">
                        <span>👤</span> Mi Perfil
                      </Link>
                    )}
                    <Link href={user?.role === 'client' ? "/client/messages" : user?.role === 'supplier' ? "/supplier/messages" : "/admin/messages"} className="px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3">
                      <span>💬</span> Mensajes
                    </Link>
                    <Link href="/favorites" className="px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3">
                      <span>❤️</span> Favoritos
                    </Link>
                    <Link href="/coupons" className="px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3">
                      <span>🎫</span> Mis Cupones
                    </Link>
                    <div className="h-px bg-border my-1" />
                    <button
                      onClick={() => logout()}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-secondary flex items-center gap-3 text-red-500"
                    >
                      <LogOut size={16} /> Cerrar Sesión
                    </button>
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
