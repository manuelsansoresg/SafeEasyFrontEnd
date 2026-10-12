"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { useChromeVisibilityStore } from "@/store/useChromeVisibilityStore";

const legalPaths = new Set(["/politicas-de-privacidad", "/terminos-y-condiciones"]);
const mobileEmbedParams = ["from_mobile", "is_mobile", "is_movil"];
const enabledValues = new Set(["1", "true", "yes", "si"]);
const marketingPaths = new Set([
  "/directorio", "/directorio/gracias",
  "/menu", "/menu/gracias",
  "/vender", "/vender/gracias",
  "/agenda", "/agenda/gracias",
]);

function isMobileEmbed(searchParams: URLSearchParams) {
  return mobileEmbedParams.some((param) => {
    const value = searchParams.get(param);
    return value ? enabledValues.has(value.toLowerCase()) : false;
  });
}

function ChromeSection({
  kind,
  normalizedPathname,
  hideForDirectory,
}: {
  kind: "header" | "footer";
  normalizedPathname: string;
  hideForDirectory: boolean;
}) {
  const searchParams = useSearchParams();
  const isSupplierPage = normalizedPathname.startsWith("/empresas/");
  const hideForLegalEmbed = legalPaths.has(normalizedPathname) && isMobileEmbed(searchParams);
  if (hideForLegalEmbed || (isSupplierPage && hideForDirectory)) return null;
  return kind === "header" ? <Header /> : <><Footer /><MobileNav /></>;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/$/, "");
  const hideForDirectory = useChromeVisibilityStore((state) => state.hideForDirectory);
  const isMarketingPage = marketingPaths.has(normalizedPathname);
  const isCancelAccountPage = normalizedPathname === "/cancel-account";
  const isPortalCustomizer = normalizedPathname === "/admin/my-company/customize";

  if (isMarketingPage || isCancelAccountPage || isPortalCustomizer) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <ChromeSection kind="header" normalizedPathname={normalizedPathname} hideForDirectory={hideForDirectory} />
      </Suspense>
      <main className="min-h-screen">{children}</main>
      <Suspense fallback={null}>
        <ChromeSection kind="footer" normalizedPathname={normalizedPathname} hideForDirectory={hideForDirectory} />
      </Suspense>
    </>
  );
}
