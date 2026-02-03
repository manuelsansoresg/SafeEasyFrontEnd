"use client";

import { useState, useEffect } from "react";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarCollapsed(true);
      } else {
         setIsSidebarCollapsed(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Protect Route
  useEffect(() => {
    if (!token) {
        // Simple check, maybe refine with loading state if store has one
        // router.push('/login');
    }
  }, [token, router]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ClientSidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={toggleSidebar} 
      />
      
      <main className="flex-1 overflow-x-hidden transition-all duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
