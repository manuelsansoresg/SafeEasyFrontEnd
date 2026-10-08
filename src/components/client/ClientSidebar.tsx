"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User, LogOut, Heart, ShoppingCart, PackageCheck, Store,
  ChevronLeft, ChevronRight, Trash2, UtensilsCrossed, CalendarCheck2,
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
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";

  const menuItems = [
    { title: "Panel Admin", path: isAdmin ? "/admin/dashboard" : "/client/profile", icon: User },
    { title: "Mis Pedidos", path: "/client/orders", icon: PackageCheck },
    { title: "Pedidos de menú", path: "/client/menu-orders", icon: UtensilsCrossed },
    { title: "Mis citas", path: "/client/appointments", icon: CalendarCheck2 },
    { title: "Mi Carrito", path: "/cart", icon: ShoppingCart },
    { title: "Favoritos", path: "/client/favorites", icon: Heart },
    ...(!isAdmin ? [{ title: "Volverme proveedor", path: "/client/become-supplier", icon: Store }] : []),
  ];

  return <>
    <motion.aside initial={false} animate={{ width: isCollapsed ? "80px" : "260px" }}
      className="relative top-0 z-40 hidden h-screen flex-col border-r border-gray-200 bg-white shadow-sm transition-all duration-300 md:sticky md:flex">
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 pt-24 md:pt-28 scrollbar-thin">
        <nav className="space-y-2 px-3">
          {menuItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return <Link key={item.path} href={item.path} title={isCollapsed ? item.title : undefined}
              aria-current={active ? "page" : undefined}
              className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200", active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-600 hover:bg-primary/5 hover:text-primary")}>
              <div className={cn("flex min-w-[24px] items-center justify-center", active ? "text-white" : "text-gray-500 group-hover:text-primary")}>
                <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <motion.span animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : "auto" }} className="overflow-hidden whitespace-nowrap font-medium">
                {item.title}
              </motion.span>
              {isCollapsed && <div className="pointer-events-none absolute left-full z-50 ml-4 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">{item.title}</div>}
            </Link>;
          })}
        </nav>
      </div>
      <div className="border-t border-gray-100 p-3">
        <Link href="/account/delete" title="Eliminar cuenta" className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
          <Trash2 size={22} strokeWidth={2} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap font-medium">Eliminar cuenta</span>}
        </Link>
        <button type="button" onClick={() => { logout(); router.push("/login"); }} title="Cerrar Sesión"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-500">
          <LogOut size={22} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap font-medium">Cerrar Sesión</span>}
        </button>
      </div>
      <button type="button" onClick={toggleSidebar}
        className="absolute -right-3 top-8 z-50 hidden rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow-md hover:text-primary md:flex"
        aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
    <nav aria-label="Menú de cliente" className="pb-safe fixed inset-x-0 bottom-0 z-50 flex h-16 items-center gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 md:hidden">
      {menuItems.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return <Link key={item.path} href={item.path} aria-current={active ? "page" : undefined}
          className={cn("flex h-full min-w-16 shrink-0 flex-col items-center justify-center gap-1 px-2 text-[10px] font-medium", active ? "text-primary" : "text-gray-600 hover:text-primary")}>
          <item.icon size={20} /><span className="whitespace-nowrap">{item.title}</span>
        </Link>;
      })}
    </nav>
  </>;
}
