import { CalendarClock, UtensilsCrossed } from "lucide-react";

export const supplierModuleScreens = [
  {
    code: "menu",
    title: "Menú",
    path: "/admin/menu",
    icon: UtensilsCrossed,
    description: "Administra tus menús, secciones, platillos y pedidos.",
  },
  {
    code: "agenda",
    title: "Agenda",
    path: "/admin/agenda",
    icon: CalendarClock,
    description: "Configura horarios, disponibilidad, servicios y reservaciones.",
  },
] as const;
