"use client";

import Link from "next/link";
import { LeadsList } from "@/components/admin/LeadsList";
import { useAuthStore } from "@/store/useAuthStore";

export default function AdminLeadsPage() {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== "admin" && user?.role !== "superuser") {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center"><h1 className="text-xl font-semibold text-gray-800">Acceso restringido</h1><p className="text-gray-500">Solo administradores pueden acceder a este módulo.</p><Link href="/admin/dashboard" className="font-semibold text-primary hover:underline">Volver al panel</Link></div>;
  }
  return <LeadsList />;
}
