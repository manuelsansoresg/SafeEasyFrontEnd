"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Loader2, Menu, X } from "lucide-react";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  const pathname = usePathname();
  const isPortalCustomizer = pathname.replace(/\/$/, "") === "/admin/my-company/customize";
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Initialize collapsed state based on screen size or preference
  // Default to collapsed on mobile (handled by media query in effect), expanded on desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

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
    <QueryClientProvider client={queryClient}>
      <div className={`flex min-w-0 bg-gray-50 ${isPortalCustomizer ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
      {!isPortalCustomizer ? <button
        type="button"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className="fixed left-4 top-24 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-primary shadow-lg shadow-black/10 transition hover:bg-gray-50 md:hidden"
        aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button> : null}

      {!isPortalCustomizer && isMobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      {!isPortalCustomizer ? <AdminSidebar
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={toggleSidebar} 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      /> : null}
      
      <main className={`min-w-0 flex-1 transition-all duration-300 ${isPortalCustomizer ? "h-dvh overflow-hidden" : "overflow-x-hidden pt-32 md:pt-28"}`}>
        <div className={isPortalCustomizer ? "h-full w-full" : "mx-auto w-full min-w-0 max-w-7xl p-4 md:p-8"}>
            {children}
        </div>
      </main>
      </div>
    </QueryClientProvider>
  );
}
