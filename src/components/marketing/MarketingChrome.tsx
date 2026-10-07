"use client";

import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import type { MouseEvent } from "react";
import { MarketingCta } from "@/components/marketing/MarketingBlocks";

const containerClass = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";

export function MarketingHeader({ contentId, onCta, onSteps }: {
  contentId: string;
  onCta: (event: MouseEvent<HTMLAnchorElement>) => void;
  onSteps: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return <>
    <a href={`#${contentId}`} className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 font-semibold text-[#004e28] shadow-lg focus:translate-y-0">Ir al contenido</a>
    <header className="sticky top-0 z-30 border-b border-[#004e28]/10 bg-white/95 backdrop-blur-sm">
      <div className={`${containerClass} flex h-16 items-center justify-between gap-3 sm:h-[72px]`}>
        <Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-10 w-28 shrink-0 sm:w-40">
          <Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill className="object-contain object-left" />
        </Link>
        <nav aria-label="Navegación de la página" className="flex items-center gap-3 sm:gap-5">
          <a href="#como-funciona" onClick={onSteps} className="hidden text-sm font-semibold text-[#004e28] hover:underline focus-visible:outline-2 focus-visible:outline-[#004e28] sm:inline">Cómo funciona</a>
          <MarketingCta href="#quiero-informacion" onClick={onCta} className="min-h-10 px-4 py-2 text-xs sm:min-h-11 sm:text-sm" />
        </nav>
      </div>
    </header>
  </>;
}

export function MarketingFooter() {
  return <footer className="border-t border-[#004e28]/10 bg-white py-8">
    <div className={`${containerClass} flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}>
      <Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-10 w-32"><Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill className="object-contain object-left" /></Link>
      <nav aria-label="Enlaces legales" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#40554a]"><Link href="/politicas-de-privacidad" className="hover:underline">Privacidad</Link><Link href="/terminos-y-condiciones" className="hover:underline">Términos</Link><Link href="/contacto" className="hover:underline">Contacto</Link></nav>
      <div className="flex gap-4 text-[#004e28]" aria-label="Redes sociales"><a href="https://www.facebook.com/drooopymexico" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} aria-hidden="true" /></a><a href="https://www.instagram.com/drooopymx" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} aria-hidden="true" /></a><a href="https://x.com/drooopymx" target="_blank" rel="noreferrer" aria-label="X"><FaXTwitter size={18} aria-hidden="true" /></a></div>
    </div>
  </footer>;
}
