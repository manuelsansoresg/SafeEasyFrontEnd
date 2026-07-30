"use client";

import Link from "next/link";
import { BriefcaseBusiness, Home, ShoppingCart, MessageSquare, User, Package, Users, Heart, LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useSupplierPageModeStore } from "@/store/useSupplierPageModeStore";

type Role = "admin" | "superuser" | "supplier" | "seller" | "client" | undefined;

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

function getNavItems(pathname: string, userRole: Role, isDirectorySupplier: boolean, isAuthenticated: boolean): NavItem[] {
  let accountHref = "/login";
  let accountLabel = "Ingresar";
  if (isAuthenticated) {
    if (userRole === "admin" || userRole === "superuser" || userRole === "seller") {
      accountHref = "/admin/dashboard";
      accountLabel = "Panel";
    } else if (userRole === "supplier") {
      accountHref = "/admin/dashboard";
      accountLabel = "Mi Cuenta";
    } else if (userRole === "client") {
      accountHref = "/admin/profile";
      accountLabel = "Mi Cuenta";
    }
  }

  const messagesHref = isAuthenticated ? "/admin/messages" : "/login";

  if (pathname.startsWith("/empresas/")) {
    const items: NavItem[] = [
      { href: "/", label: "Inicio", icon: Home },
      {
        href: `${pathname}${isDirectorySupplier ? "#servicios" : "#productos"}`,
        label: isDirectorySupplier ? "Servicios" : "Productos",
        icon: isDirectorySupplier ? BriefcaseBusiness : Package,
      },
      { href: `${pathname}#nosotros`, label: "Nosotros", icon: Users },
      { href: `${pathname}#contacto`, label: "Contacto", icon: MessageSquare },
      { href: accountHref, label: accountLabel, icon: User },
    ];
    return items;
  }

  // Non-supplier pages
  const base: NavItem[] = [
    { href: "/", label: "Inicio", icon: Home },
  ];

  if (userRole === "client") {
    base.push(
      { href: "/client/favorites", label: "Favoritos", icon: Heart },
      { href: "/cart", label: "Carrito", icon: ShoppingCart },
      { href: messagesHref, label: "Mensajes", icon: MessageSquare },
      { href: accountHref, label: accountLabel, icon: User },
    );
  } else if (userRole === "supplier") {
    base.push(
      { href: "/admin/products", label: "Productos", icon: Package },
      { href: "/admin/orders", label: "Órdenes", icon: ShoppingCart },
      { href: "/admin/messages", label: "Mensajes", icon: MessageSquare },
      { href: accountHref, label: accountLabel, icon: User },
    );
  } else if (userRole === "admin" || userRole === "superuser") {
    base.push(
      { href: "/client/favorites", label: "Favoritos", icon: Heart },
      { href: "/cart", label: "Carrito", icon: ShoppingCart },
      { href: messagesHref, label: "Mensajes", icon: MessageSquare },
      { href: "/admin/dashboard", label: "Panel", icon: LayoutDashboard },
    );
  } else if (userRole === "seller") {
    base.push(
      { href: "/client/favorites", label: "Favoritos", icon: Heart },
      { href: "/cart", label: "Carrito", icon: ShoppingCart },
      { href: messagesHref, label: "Mensajes", icon: MessageSquare },
      { href: "/admin/dashboard", label: "Panel", icon: LayoutDashboard },
    );
  } else {
    // Not authenticated
    base.push(
      { href: "/cart", label: "Carrito", icon: ShoppingCart },
      { href: "/login", label: "Ingresar", icon: User },
    );
  }

  return base;
}

export function MobileNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const isDirectorySupplier = useSupplierPageModeStore((state) => state.isDirectory);

  const navItems = getNavItems(pathname, user?.role, isDirectorySupplier, isAuthenticated);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 pb-safe">
      <div className="flex items-center justify-around h-16 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isExternal = item.href.startsWith("#") || item.href.includes("#");
          const isActive = isExternal
            ? pathname === item.href.split("#")[0]
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] h-full gap-1 transition-colors px-2 flex-shrink-0",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
