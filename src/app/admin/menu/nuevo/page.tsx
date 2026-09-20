"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { MenuWizard } from "@/components/admin/menu/MenuWizard";
import { ModuleAccessError } from "@/components/admin/ModuleAccessError";
import { PageHero } from "@/components/ui/PageHero";
import { useSupplierModules } from "@/hooks/useSupplierModules";

export default function NewMenuWizardPage() {
  const {
    loading: accessLoading,
    error: accessError,
    hasModule,
    retry,
  } = useSupplierModules();

  const hasAccess = hasModule("menu");

  if (accessLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={32} />
      </div>
    );
  }

  if (accessError) {
    return <ModuleAccessError onRetry={() => void retry()} />;
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero
          title="Menú"
          subtitle="Administra los menús de tu negocio."
          eyebrow="Módulo"
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold">El módulo Menú no está activo en tu cuenta</h2>
              <p className="mt-1 text-sm">
                Activa o solicita el módulo antes de crear un menú.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <MenuWizard />;
}
