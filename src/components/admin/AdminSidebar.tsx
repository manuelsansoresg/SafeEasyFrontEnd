"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  User, 
  Users,
  Users2,
  ChevronDown,
  Grid, 
  Layers, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Truck,
  BadgeDollarSign,
  Repeat,
  Settings,
  FileText,
  LifeBuoy,
  CircleHelp
} from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

interface AdminSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

type AdminRole = "admin" | "superuser" | "supplier" | "client";

type MenuChildItem = {
  title: string;
  path: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  roles: AdminRole[];
};

type MenuItem = MenuChildItem & {
  children?: MenuChildItem[];
};

export function AdminSidebar({ isCollapsed, toggleSidebar, isMobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  
  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      title: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
      roles: ['admin', 'superuser', 'supplier']
    },
    { 
      title: "Mi Empresa", 
      path: "/admin/my-company", 
      icon: Grid,
      roles: ['supplier']
    },
    { 
      title: "Perfil", 
      path: "/admin/profile", 
      icon: User,
      roles: ['admin', 'superuser', 'supplier', 'client']
    },
    {
      title: "Contenido",
      path: "/admin/content",
      icon: FileText,
      roles: ['admin', 'superuser'],
      children: [
        {
          title: "Categorías",
          path: "/admin/categories",
          icon: Grid,
          roles: ['admin', 'superuser']
        },
        {
          title: "Subcategorías",
          path: "/admin/subcategories",
          icon: Layers,
          roles: ['admin', 'superuser']
        },
        {
          title: "Anuncios",
          path: "/admin/ads",
          icon: ImageIcon,
          roles: ['admin', 'superuser']
        },
        {
          title: "Preguntas",
          path: "/admin/sell-faq",
          icon: CircleHelp,
          roles: ['admin', 'superuser']
        },
        {
          title: "Legales",
          path: "/admin/legal",
          icon: FileText,
          roles: ['admin', 'superuser']
        },
      ],
    },
    {
      title: "Usuarios",
      path: "/admin/users",
      icon: Users2,
      roles: ['admin', 'superuser'],
      children: [
        {
          title: "Usuarios",
          path: "/admin/users",
          icon: Users2,
          roles: ['admin', 'superuser']
        },
        {
          title: "Proveedores",
          path: "/admin/suppliers",
          icon: Users,
          roles: ['admin', 'superuser']
        },
        {
          title: "Repartidores",
          path: "/admin/couriers",
          icon: Truck,
          roles: ['admin', 'superuser']
        },
      ],
    },
    { 
      title: "Mis Productos", 
      path: "/admin/products", 
      icon: Package,
      roles: ['admin', 'superuser', 'supplier']
    },
    {
      title: "Soporte",
      path: "/admin/support",
      icon: LifeBuoy,
      roles: ['admin', 'superuser']
    },
    { 
      title: "Órdenes", 
      path: "/admin/orders", 
      icon: ShoppingCart,
      roles: ['supplier']
    },
    { 
      title: "Estadísticas", 
      path: "/admin/stats", 
      icon: BarChart3,
      roles: ['supplier']
    },
    {
      title: "Mi Subscripción",
      path: "/admin/my-subscription",
      icon: BadgeDollarSign,
      roles: ['supplier']
    },
    {
      title: "Envíos",
      path: "/admin/settings/shipping",
      icon: Truck,
      roles: ['admin']
    },
    {
      title: "Configuración",
      path: "/admin/settings/configuracion",
      icon: Settings,
      roles: ['admin', 'superuser']
    },
    {
      title: "Planes",
      path: "/admin/plans",
      icon: BadgeDollarSign,
      roles: ['admin', 'superuser']
    },
    {
      title: "Subscripciones",
      path: "/admin/subscriptions",
      icon: Repeat,
      roles: ['admin', 'superuser']
    }
  ];

  const canSeeItem = (item: MenuChildItem) =>
    !item.roles || (user?.role && item.roles.includes(user.role as AdminRole)) || (isAdmin && item.roles?.includes('admin'));

  const filteredMenuItems = menuItems
    .map((item) => ({
      ...item,
      children: item.children?.filter(canSeeItem),
    }))
    .filter((item) => canSeeItem(item) && (!item.children || item.children.length > 0));

  return (
    <motion.aside
      initial={false}
      animate={{ 
        width: isMobileOpen ? "280px" : isCollapsed ? "80px" : "260px",
      }}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-white shadow-xl transition-transform duration-300 md:sticky md:top-0 md:z-40 md:h-screen md:border-r md:border-gray-200 md:shadow-sm",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Navigation Items */}
      <div className="flex-1 py-6 pt-24 md:pt-28 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <nav className="space-y-2 px-3">
          {filteredMenuItems.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isActive = hasChildren
              ? item.children?.some((child) => pathname === child.path || pathname.startsWith(child.path))
              : pathname === item.path || pathname.startsWith(item.path);
            const isOpen = openMenus[item.path] ?? isActive;
            
            if (hasChildren) {
              return (
                <div key={item.path} className="group/menu relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenus((prev) => ({ ...prev, [item.path]: !isOpen }))}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
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
                      animate={{ opacity: isMobileOpen || !isCollapsed ? 1 : 0, width: isMobileOpen || !isCollapsed ? "auto" : 0 }}
                      className="font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.title}
                    </motion.span>

                    <motion.span
                      animate={{ opacity: isMobileOpen || !isCollapsed ? 1 : 0, rotate: isOpen ? 180 : 0 }}
                      className="ml-auto text-current"
                    >
                      <ChevronDown size={16} />
                    </motion.span>
                  </button>

                  {(!isCollapsed || isMobileOpen) && isOpen ? (
                    <div className="mt-1 space-y-1 pl-4">
                      {item.children?.map((child) => {
                        const childActive = pathname === child.path || pathname.startsWith(child.path);
                        return (
                          <Link
                            key={child.path}
                            href={child.path}
                            onClick={() => {
                              setOpenMenus({});
                              onMobileClose?.();
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                              childActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-gray-500 hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            <child.icon size={19} strokeWidth={childActive ? 2.5 : 2} />
                            <span className="whitespace-nowrap">{child.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}

                  {isCollapsed && !isMobileOpen && (
                    <div className="absolute left-full top-0 ml-4 hidden min-w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-xl group-hover/menu:block z-50">
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {item.title}
                      </p>
                      {item.children?.map((child) => {
                        const childActive = pathname === child.path || pathname.startsWith(child.path);
                        return (
                          <Link
                            key={child.path}
                            href={child.path}
                            onClick={() => {
                              setOpenMenus({});
                              onMobileClose?.();
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              childActive
                                ? "bg-primary text-white"
                                : "text-gray-600 hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            <child.icon size={18} />
                            <span>{child.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => {
                  setOpenMenus({});
                  onMobileClose?.();
                }}
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
                  animate={{ opacity: isMobileOpen || !isCollapsed ? 1 : 0, width: isMobileOpen || !isCollapsed ? "auto" : 0 }}
                  className="font-medium whitespace-nowrap overflow-hidden"
                >
                  {item.title}
                </motion.span>

                {/* Tooltip for collapsed mode */}
                {isCollapsed && !isMobileOpen && (
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
                animate={{ opacity: isMobileOpen || !isCollapsed ? 1 : 0, width: isMobileOpen || !isCollapsed ? "auto" : 0 }}
                className="font-medium whitespace-nowrap overflow-hidden"
             >
                Cerrar Sesión
             </motion.span>
         </button>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-8 bg-white border border-gray-200 text-gray-500 hover:text-primary p-1 rounded-full shadow-md z-50 hidden md:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}
