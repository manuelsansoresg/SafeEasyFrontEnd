"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  User, 
  MessageSquare,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

interface ClientSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export function ClientSidebar({ isCollapsed, toggleSidebar }: ClientSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  
  // Menu items configuration
  const menuItems = [
    { 
      title: "Mi Perfil", 
      path: "/client/profile", 
      icon: User,
    },
    // Mis Mensajes item removed
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ 
        width: isCollapsed ? "80px" : "260px",
      }}
      className={cn(
        "relative flex flex-col h-screen bg-white border-r border-gray-200 shadow-sm transition-all duration-300 z-40 sticky top-0",
      )}
    >
      {/* Header / Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 overflow-hidden px-4 w-full">
          <div className="min-w-[32px] h-8 flex items-center justify-center text-primary">
            {/* Simple Logo Icon */}
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-xl text-primary">S</span>
            </div>
          </div>
          
          <motion.div
            animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : "auto" }}
            transition={{ duration: 0.2 }}
            className="whitespace-nowrap overflow-hidden"
          >
            <span className="text-lg font-bold text-gray-800">SafeEasy</span>
            <span className="text-xs text-gray-500 block">Panel Cliente</span>
          </motion.div>
        </Link>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-6 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <nav className="space-y-2 px-3">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-gray-600 hover:bg-primary/5 hover:text-primary"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <div className={cn(
                  "min-w-[24px] flex items-center justify-center transition-colors",
                  isActive ? "text-white" : "text-gray-500 group-hover:text-primary"
                )}>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <motion.span
                  animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : "auto" }}
                  className="font-medium whitespace-nowrap overflow-hidden"
                >
                  {item.title}
                </motion.span>

                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.title}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Info */}
      <div className="p-3 border-t border-gray-100">
         <button
            onClick={() => logout()}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors group"
            )}
            title="Cerrar Sesión"
         >
             <div className="min-w-[24px] flex items-center justify-center">
                <LogOut size={22} />
             </div>
             <motion.span
                animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : "auto" }}
                className="font-medium whitespace-nowrap overflow-hidden"
             >
               Cerrar Sesión
             </motion.span>
         </button>
      </div>
    </motion.aside>
  );
}
