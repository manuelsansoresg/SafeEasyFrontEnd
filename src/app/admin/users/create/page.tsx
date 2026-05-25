"use client";

import UserForm from "@/components/admin/UserForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateUserPage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Usuario"
        subtitle="Crea un nuevo usuario en el sistema."
        actions={
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <UserForm />
    </div>
  );
}
