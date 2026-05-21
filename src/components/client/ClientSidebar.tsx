"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  User, 
  LogOut,
  Heart,
  ShoppingCart,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
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
  const router = useRouter();
  const { logout } = useAuthStore();
  
  // Menu items configuration
  const menuItems = [
    { 
      title: "Mi Perfil", 
      path: "/client/profile", 
      icon: User,
    },
    {
      title: "Mis Pedidos",
      path: "/client/orders",
      icon: PackageCheck,
    },
    {
      title: "Mi Carrito",
      path: "/cart",
      icon: ShoppingCart,
    },
    {
      title: "Favoritos",
      path: "/client/favorites",
      icon: Heart,
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
        "hidden md:flex relative flex-col h-screen bg-white border-r border-gray-200 shadow-sm transition-all duration-300 z-40 sticky top-0",
      )}
    >
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
            onClick={() => {
              logout();
              router.push("/login");
            }}
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

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 bg-white border border-gray-200 text-gray-500 hover:text-primary p-1 rounded-full shadow-md z-50 hidden md:flex"
        aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}
