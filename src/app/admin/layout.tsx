"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Loader2, Menu, X } from "lucide-react";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import {
  getBrowserPathWithSearchAndHash,
  getLoginUrl,
} from "@/lib/authRedirect";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Initialize collapsed state based on screen size or preference
  // Default to collapsed on mobile (handled by media query in effect), expanded on desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      if (mobile) {
        setIsSidebarCollapsed(true);
      } else {
         // Optionally restore user preference here
         setIsSidebarCollapsed(false);
      }
    };

    // Initial check
    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!hydrated || isAuthenticated) return;
    router.replace(getLoginUrl(getBrowserPathWithSearchAndHash()));
  }, [hydrated, isAuthenticated, router]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-gray-500">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span>Verificando sesión...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className="fixed left-4 top-24 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-primary shadow-lg shadow-black/10 transition hover:bg-gray-50 md:hidden"
        aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isMobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      <AdminSidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={toggleSidebar} 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      
      <main className="flex-1 overflow-x-hidden transition-all duration-300 pt-32 md:pt-28">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
