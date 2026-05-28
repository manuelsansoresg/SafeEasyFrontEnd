"use client";

import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Menu, X } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

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
