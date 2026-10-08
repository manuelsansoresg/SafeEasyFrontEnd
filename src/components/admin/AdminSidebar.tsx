"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User, Users, Users2, ChevronDown, Grid, Layers, Package,
  ChevronLeft, ChevronRight, LogOut, LayoutDashboard, ShoppingCart,
  PackageCheck, Heart, BarChart3, Store, Truck, BadgeDollarSign,
  Repeat, Settings, FileText, LifeBuoy, CircleHelp, Trash2, Tags,
  Blocks, ContactRound, BriefcaseBusiness, Image as ImageIcon, Images,
  UtensilsCrossed, CalendarClock, ClipboardList, CalendarCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { useSupplierModules } from "@/hooks/useSupplierModules";

interface AdminSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

type AdminRole = "admin" | "superuser" | "supplier" | "seller" | "client";
type ItemIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type MenuChildItem = { title: string; path: string; icon: ItemIcon; roles: AdminRole[] };
type MenuItem = MenuChildItem & { children?: MenuChildItem[] };

const matchPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export function AdminSidebar({
  isCollapsed, toggleSidebar, isMobileOpen = false, onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const isSupplier = user?.role === "supplier";
  const { hasModule } = useSupplierModules(isSupplier);
  const { isDirectory } = useMyDirectorySubscription(isSupplier);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const expanded = !isCollapsed || isMobileOpen;

  const menuItems: MenuItem[] = [
    { title: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin", "superuser", "supplier", "seller"] },
    { title: "Mi Negocio", path: "/admin/my-company", icon: Grid, roles: ["supplier"] },
    { title: "Perfil", path: "/admin/profile", icon: User, roles: ["admin", "superuser", "supplier", "seller", "client"] },
    { title: "Mis Pedidos", path: "/client/orders", icon: PackageCheck, roles: ["admin", "superuser"] },
    { title: "Mi Carrito", path: "/cart", icon: ShoppingCart, roles: ["admin", "superuser"] },
    { title: "Favoritos", path: "/client/favorites", icon: Heart, roles: ["admin", "superuser"] },
    {
      title: "Contenido", path: "/admin/content", icon: FileText, roles: ["admin", "superuser"],
      children: [
        { title: "Categorías", path: "/admin/categories", icon: Grid, roles: ["admin", "superuser"] },
        { title: "Subcategorías", path: "/admin/subcategories", icon: Layers, roles: ["admin", "superuser"] },
        { title: "Tipos de negocio", path: "/admin/business-types", icon: BriefcaseBusiness, roles: ["admin"] },
        { title: "Anuncios", path: "/admin/ads", icon: ImageIcon, roles: ["admin", "superuser"] },
        { title: "Preguntas", path: "/admin/sell-faq", icon: CircleHelp, roles: ["admin", "superuser"] },
        { title: "Legales", path: "/admin/legal", icon: FileText, roles: ["admin", "superuser"] },
        { title: "Planes", path: "/admin/plans", icon: BadgeDollarSign, roles: ["admin", "superuser"] },
        { title: "Módulos", path: "/admin/modules", icon: Blocks, roles: ["admin"] },
      ],
    },
    {
      title: "Usuarios", path: "/admin/users", icon: Users2, roles: ["admin", "superuser"],
      children: [
        { title: "Usuarios", path: "/admin/users", icon: Users2, roles: ["admin", "superuser"] },
        { title: "Proveedores", path: "/admin/suppliers", icon: Users, roles: ["admin", "superuser"] },
        { title: "Vendedores", path: "/admin/sellers", icon: Store, roles: ["admin", "superuser"] },
        { title: "Repartidores", path: "/admin/couriers", icon: Truck, roles: ["admin", "superuser"] },
        { title: "Eliminados", path: "/admin/deleted-users", icon: Trash2, roles: ["admin", "superuser"] },
      ],
    },
    {
      title: isDirectory ? "Mis Servicios" : "Mis Productos",
      path: isDirectory ? "/admin/services" : "/admin/products",
      icon: isDirectory ? BriefcaseBusiness : Package,
      roles: ["admin", "superuser", "supplier"],
    },
    { title: "Mis categorías", path: "/admin/my-categories", icon: Tags, roles: ["supplier"] },
    ...(isSupplier && hasModule("menu") ? [{
      title: "Menú", path: "/admin/menu", icon: UtensilsCrossed, roles: ["supplier"] as AdminRole[],
      children: [
        { title: "Mis menús", path: "/admin/menu", icon: UtensilsCrossed, roles: ["supplier"] as AdminRole[] },
        { title: "Pedidos recibidos", path: "/admin/menu/pedidos", icon: ClipboardList, roles: ["supplier"] as AdminRole[] },
      ],
    }] : []),
    ...(isSupplier && hasModule("agenda") ? [{
      title: "Agenda", path: "/admin/agenda", icon: CalendarClock, roles: ["supplier"] as AdminRole[],
      children: [
        { title: "Configurar agenda", path: "/admin/agenda", icon: Settings, roles: ["supplier"] as AdminRole[] },
        { title: "Gestionar citas", path: "/admin/agenda/appointments", icon: CalendarCheck2, roles: ["supplier"] as AdminRole[] },
      ],
    }] : []),
    ...(isSupplier && isDirectory ? [
      { title: "Galería", path: "/admin/gallery", icon: Images, roles: ["supplier"] as AdminRole[] },
    ] : []),
    ...(isSupplier && !isDirectory ? [
      { title: "Órdenes", path: "/admin/orders", icon: ShoppingCart, roles: ["supplier"] as AdminRole[] },
      { title: "Estadísticas", path: "/admin/stats", icon: BarChart3, roles: ["supplier"] as AdminRole[] },
    ] : []),
    { title: "Soporte", path: "/admin/support", icon: LifeBuoy, roles: ["admin", "superuser"] },
    { title: "Prospectos", path: "/admin/leads", icon: ContactRound, roles: ["admin"] },
    { title: "Mi Subscripción", path: "/admin/my-subscription", icon: BadgeDollarSign, roles: ["supplier"] },
    { title: "Configuración", path: "/admin/settings/configuracion", icon: Settings, roles: ["admin", "superuser"] },
    { title: "Subscripciones", path: "/admin/subscriptions", icon: Repeat, roles: ["admin", "superuser"] },
  ];

  const canSeeItem = (item: MenuChildItem) => Boolean(user?.role && item.roles.includes(user.role as AdminRole));
  const visibleItems = menuItems.map((item) => ({
    ...item, children: item.children?.filter(canSeeItem),
  })).filter((item) => canSeeItem(item) && (!item.children || item.children.length > 0));

  const navigate = () => {
    onMobileClose?.();
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isMobileOpen ? "280px" : isCollapsed ? "80px" : "260px" }}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-white shadow-xl transition-transform duration-300 md:sticky md:top-0 md:z-40 md:h-screen md:border-r md:border-gray-200 md:shadow-sm",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 pt-24 md:pt-28 scrollbar-thin">
        <nav className="space-y-2 px-3">
          {visibleItems.map((item) => {
            const children = item.children;
            const hasChildren = Boolean(children?.length);
            // Las rutas más específicas tienen prioridad: pedidos no activa también «Mis menús».
            const selectedChild = children?.filter((child) => matchPath(pathname, child.path))
              .sort((a, b) => b.path.length - a.path.length)[0];
            const isActive = hasChildren ? Boolean(selectedChild) : matchPath(pathname, item.path);
            const isOpen = openMenus[item.path] ?? isActive;
            const icon = <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />;
            const content = <>
              <span className={cn("flex min-w-[24px] items-center justify-center", isActive ? "text-white" : "text-gray-500 group-hover:text-primary")}>{icon}</span>
              {expanded && <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left font-medium">{item.title}</span>}
            </>;
            const topClasses = cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
              isActive ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-600 hover:bg-primary/5 hover:text-primary",
            );
            if (!hasChildren) {
              return <Link key={item.path} href={item.path} onClick={navigate} title={!expanded ? item.title : undefined} className={topClasses}>{content}</Link>;
            }
            return <div key={item.path} className="group/menu relative">
              <button
                type="button"
                className={topClasses}
                title={!expanded ? item.title : undefined}
                aria-expanded={isOpen}
                aria-controls={`submenu-${item.path.replaceAll("/", "-")}`}
                onClick={() => {
                  if (!expanded) toggleSidebar();
                  setOpenMenus((previous) => ({ ...previous, [item.path]: !isOpen }));
                }}
              >
                {content}
                {expanded && <ChevronDown size={16} className={cn("shrink-0 transition-transform", isOpen && "rotate-180")} />}
              </button>
              {expanded && isOpen && <div id={`submenu-${item.path.replaceAll("/", "-")}`} className="mt-1 space-y-1 pl-4">
                {children?.map((child) => {
                  const childActive = selectedChild?.path === child.path;
                  return <Link key={child.path} href={child.path} onClick={navigate}
                    aria-current={childActive ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200", childActive ? "bg-primary/10 font-semibold text-primary" : "text-gray-500 hover:bg-primary/5 hover:text-primary")}
                  >
                    <child.icon size={19} strokeWidth={childActive ? 2.5 : 2} />
                    <span className="whitespace-nowrap">{child.title}</span>
                  </Link>;
                })}
              </div>}
              {!expanded && <div className="absolute left-full top-0 z-50 ml-4 hidden min-w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-xl group-hover/menu:block">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{item.title}</p>
                {children?.map((child) => <Link key={child.path} href={child.path} onClick={navigate}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", selectedChild?.path === child.path ? "bg-primary text-white" : "text-gray-600 hover:bg-primary/5 hover:text-primary")}
                ><child.icon size={18} /><span>{child.title}</span></Link>)}
              </div>}
            </div>;
          })}
        </nav>
      </div>
      <div className="border-t border-gray-100 p-3">
        {!isAdmin && <Link href="/account/delete" onClick={navigate} title="Eliminar cuenta" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
          <Trash2 size={22} strokeWidth={2} className="shrink-0" />
          {expanded && <span className="whitespace-nowrap font-medium">Eliminar cuenta</span>}
        </Link>}
        <button type="button" onClick={() => { logout(); router.push("/login"); }} title="Cerrar Sesión"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-500">
          <LogOut size={22} className="shrink-0" />
          {expanded && <span className="whitespace-nowrap font-medium">Cerrar Sesión</span>}
        </button>
      </div>
      <button type="button" onClick={toggleSidebar}
        className="absolute -right-4 top-24 z-50 hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-lg shadow-black/10 transition hover:border-primary/30 hover:text-primary md:flex"
        aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"} title={isCollapsed ? "Expandir menú" : "Colapsar menú"}>
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </motion.aside>
  );
}
