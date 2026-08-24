"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { cn } from "@/lib/utils";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "superuser";

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const sidebar = isAdmin ? (
    <AdminSidebar
      isCollapsed={isCollapsed}
      toggleSidebar={() => setIsCollapsed(!isCollapsed)}
      isMobileOpen={isMobileOpen}
      onMobileClose={() => setIsMobileOpen(false)}
    />
  ) : (
    <ClientSidebar
      isCollapsed={isCollapsed}
      toggleSidebar={() => setIsCollapsed(!isCollapsed)}
    />
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-24 z-[60] rounded-lg bg-white p-2 shadow-md md:hidden"
        aria-label="Abrir menú"
      >
        <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:sticky md:top-0 md:z-auto md:translate-x-0 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 pt-24 md:pt-28">
        {children}
      </main>
    </div>
  );
}
