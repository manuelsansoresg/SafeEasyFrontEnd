"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { registerInteraction } from "@/lib/interactions";
import { MessagesDropdown } from "@/components/chat/MessagesDropdown";
import { useChatStore } from "@/store/useChatStore";

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
    <form onSubmit={handleSearch} className="relative w-full sm:w-64 md:w-96 flex items-center">
      <input
        type="text"
        placeholder="Buscar"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-9 pl-5 pr-10 rounded-full border-2 border-white bg-transparent text-white placeholder:text-white/80 focus:outline-none focus:ring-1 focus:ring-white transition-all text-sm font-medium"
      />
      <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-[#7ed957] transition-colors">
        <Search size={20} strokeWidth={2.5} />
      </button>
    </form>
  );
}

export function Header() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { fetchFavorites } = useFavoritesStore();
  const { connectSocket, disconnectSocket, fetchConversations } = useChatStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchFavorites();
      fetchConversations();
      
      const interval = setInterval(() => {
          fetchConversations();
      }, 60000);
      return () => clearInterval(interval);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, user?.id]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col font-sans">
      {/* Top Bar */}
      <div className="bg-white text-black py-2 px-4 text-center text-[10px] sm:text-xs md:text-sm italic border-b border-gray-100 hidden sm:block">
        Promociona tu marca en Drooopy.com • Encuentra lo que buscas, chatea directo con el vendedor y compra seguro.
      </div>

      {/* Main Header */}
      <div className="bg-primary text-white shadow-md transition-all duration-300">
        <div className="container mx-auto px-4 h-20 md:h-24 flex items-center justify-between">
          
          {/* Left Side: Logo + Nav */}
          <div className="flex items-center gap-8 md:gap-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
               <div className="relative w-56 h-14 md:w-[200px] md:h-20">
                 <Image 
                   src="/logo-drooopy.svg" 
                   alt="Drooopy Logo" 
                   fill
                   className="object-contain object-left"
                   priority
                 />
               </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-base font-medium font-[family-name:var(--font-varela-round)]">
              <Link href="/" className="hover:text-[#7ed957] transition-colors text-white">
                Inicio
              </Link>
              <Link href="/nosotros" className="hover:text-[#7ed957] transition-colors text-white">
                Nosotros
              </Link>
              <Link href="/contacto" className="hover:text-[#7ed957] transition-colors text-white">
                Contacto
              </Link>
            </nav>
          </div>

          {/* Right Side: Search + Actions */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Search Bar (Desktop) */}
            <div className="hidden md:block">
              <Suspense fallback={<div className="w-64 h-10 bg-primary/50 border border-white/30 rounded-full" />}>
                <SearchBar />
              </Suspense>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Messages */}
              {isAuthenticated && <MessagesDropdown />}

              {/* User Menu */}
              <div
                className="relative"
                onMouseEnter={() => setIsUserMenuOpen(true)}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                {isAuthenticated ? (
                  <button className="flex items-center justify-center w-10 h-10 rounded-full text-white hover:text-[#7ed957] transition-all">
                    {user?.name ? (
                        <span className="font-bold text-lg">{user.name.charAt(0).toUpperCase()}</span>
                    ) : (
                        <i className="fa-solid fa-circle-user text-[28px]" />
                    )}
                  </button>
                ) : (
                  <Link href="/login" className="flex items-center justify-center w-10 h-10 rounded-full text-white hover:text-[#7ed957] transition-all">
                    <i className="fa-solid fa-circle-user text-[28px]" />
                  </Link>
                )}

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {isUserMenuOpen && isAuthenticated && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white text-black rounded-xl shadow-xl border border-gray-100 overflow-hidden py-2"
                    >
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="font-semibold text-sm text-primary">Hola, {user?.name}</p>
                      </div>
                      <nav className="flex flex-col">
                        {(user?.role === 'admin' || user?.role === 'supplier') && (
                          <Link href="/admin/dashboard" className="px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-700 hover:text-primary">
                            <span>🛡️</span> {user.role === 'admin' ? 'Panel Admin' : 'Mi Empresa'}
                          </Link>
                        )}
                        {user?.role === 'client' && (
                          <Link href="/client/profile" className="px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-700 hover:text-primary">
                            <span>👤</span> Mi Perfil
                          </Link>
                        )}
                        <Link href="/client/favorites" className="px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-primary">
                          <span>❤️</span> Favoritos
                        </Link>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                          onClick={() => {
                            logout();
                            router.push("/login");
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-3 text-red-500"
                        >
                          <LogOut size={16} /> Cerrar Sesión
                        </button>
                      </nav>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Menu Toggle */}
              <button 
                className="md:hidden text-white hover:text-secondary transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="md:hidden bg-primary border-t border-white/10 overflow-hidden"
                >
                    <div className="p-4 flex flex-col gap-4">
                        <div className="pb-4 border-b border-white/10">
                            <Suspense fallback={<div className="w-full h-10 bg-primary/50 rounded-full" />}>
                                <SearchBar />
                            </Suspense>
                        </div>
                        <nav className="flex flex-col gap-2">
                            <Link href="/" className="py-2 px-4 hover:bg-white/10 rounded-lg transition-colors">Inicio</Link>
                            <Link href="/nosotros" className="py-2 px-4 hover:bg-white/10 rounded-lg transition-colors">Nosotros</Link>
                            <Link href="/contacto" className="py-2 px-4 hover:bg-white/10 rounded-lg transition-colors">Contacto</Link>
                        </nav>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </header>
  );
}
