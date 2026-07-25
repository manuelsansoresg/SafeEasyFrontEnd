"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { useAuthStore } from "@/store/useAuthStore";

type ClientShellProps = {
  children: React.ReactNode;
};

export function ClientShell({ children }: ClientShellProps) {
  const userRole = useAuthStore((state) => state.user?.role);
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
