"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { Loader2, LogIn } from "lucide-react";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type ClientShellProps = {
  children: React.ReactNode;
};

export function ClientShell({ children }: ClientShellProps) {
  const userRole = useAuthStore((state) => state.user?.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthHydrated();
  const requireAuth = useRequireAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isAdmin = userRole === "admin" || userRole === "superuser";

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsSidebarCollapsed(mobile);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-gray-500">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span>Verificando sesión...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 pt-28">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <LogIn className="mx-auto text-primary" size={40} />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Inicia sesión para continuar
          </h1>
          <p className="mt-2 text-gray-500">
            Después de iniciar sesión volverás a esta misma sección.
          </p>
          <button
            type="button"
            onClick={() => requireAuth(() => undefined)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <LogIn size={18} />
            Iniciar sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isAdmin ? (
        <AdminSidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        />
      ) : (
        <ClientSidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        />
      )}

      <main className="flex-1 overflow-x-hidden transition-all duration-300 pt-24 md:pt-28">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
