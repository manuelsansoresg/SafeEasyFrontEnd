"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";

const legalPaths = new Set(["/politicas-de-privacidad", "/terminos-y-condiciones"]);
const mobileEmbedParams = ["from_mobile", "is_mobile", "is_movil"];
const enabledValues = new Set(["1", "true", "yes", "si"]);

function isMobileEmbed(searchParams: URLSearchParams) {
  return mobileEmbedParams.some((param) => {
    const value = searchParams.get(param);
    return value ? enabledValues.has(value.toLowerCase()) : false;
  });
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPathname = pathname.replace(/\/$/, "");
  const hideChrome = legalPaths.has(normalizedPathname) && isMobileEmbed(searchParams);

  return (
    <>
      {!hideChrome && <Header />}
      <main className="min-h-screen">{children}</main>
      {!hideChrome && <Footer />}
      {!hideChrome && <MobileNav />}
    </>
  );
}
