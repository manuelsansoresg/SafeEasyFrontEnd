"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CompanyWorkspace, normalizeCompanyTab, type CompanySupplier } from "@/components/admin/company/CompanyWorkspace";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { useSupplierModules } from "@/hooks/useSupplierModules";
import { supplierModuleScreens } from "@/lib/supplierModules";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { useAuthStore } from "@/store/useAuthStore";

function MyCompanyContent() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDirectory, loading: directoryLoading } = useMyDirectorySubscription(Boolean(token));
  const { hasModule } = useSupplierModules();
  const enabledModules = supplierModuleScreens.filter((module) => hasModule(module.code));
  const [supplier, setSupplier] = useState<CompanySupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = normalizeCompanyTab(searchParams.get("tab"));

  const fetchSupplier = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !token) return;
    if (!options?.silent) setLoading(true);
    try {
      setSupplier((await resolveCurrentSupplier(user)) as CompanySupplier | null);
    } catch (error) {
      console.error("Error fetching supplier", error);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (user && token) void fetchSupplier();
  }, [fetchSupplier, token, user]);

  const navigate = useCallback((tab: string) => {
    router.replace(`/admin/my-company?tab=${tab}`, { scroll: false });
  }, [router]);

  if (loading || directoryLoading) {
    return <div className="grid min-h-[420px] place-items-center rounded-2xl border border-gray-200 bg-white"><div className="text-center text-gray-500"><Loader2 className="mx-auto mb-3 animate-spin text-[#168e00]" size={30} /><p className="text-sm font-medium">Preparando tu negocio…</p></div></div>;
  }
  if (!supplier) {
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Mi negocio</h1><p className="mt-2 text-sm text-amber-800">No encontramos una empresa asociada a esta cuenta.</p></section>;
  }

  return <CompanyWorkspace supplier={supplier} token={token!} isDirectory={isDirectory} enabledModules={enabledModules} activeTab={activeTab} onNavigate={navigate} onSupplierUpdated={() => fetchSupplier({ silent: true })} isSupplierAccount={user?.role === "supplier"} />;
}


export default function MyCompanyPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-gray-500">Cargando mi negocio…</div>}><MyCompanyContent /></Suspense>;
}
