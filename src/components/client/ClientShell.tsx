"use client";

import { useEffect, useState } from "react";
import { ClientSidebar } from "@/components/client/ClientSidebar";

type ClientShellProps = {
  children: React.ReactNode;
};

export function ClientShell({ children }: ClientShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      <ClientSidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
      />

      <main className="flex-1 overflow-x-hidden transition-all duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
