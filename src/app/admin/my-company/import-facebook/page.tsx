"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canAccessFacebookImport } from "@/lib/facebookImportAccess";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";

const FacebookImportFlow = dynamic(() => import("@/components/admin/facebook/FacebookImportFlow"));

export default function ImportFacebookPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const allowed = useAuthStore((state) => state.isAuthenticated && canAccessFacebookImport(state.user?.email));

  useEffect(() => {
    if (hydrated && !allowed) router.replace("/admin/my-company");
  }, [hydrated, allowed, router]);

  if (!hydrated || !allowed) return null;

  return <FacebookImportFlow />;
}
