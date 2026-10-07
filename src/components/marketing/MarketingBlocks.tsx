"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, MessageCircle } from "lucide-react";
import type { MouseEvent } from "react";

export const primaryCtaClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#158900] px-6 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#116f04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] sm:text-base";

type CtaProps = {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  label?: string;
};

export function MarketingCta({ href, onClick, className = "", label = "Quiero información" }: CtaProps) {
  return <Link href={href} onClick={onClick} className={`${primaryCtaClass} ${className}`}>{label} <ArrowRight size={18} aria-hidden="true" /></Link>;
}

export function MarketingFaq({ items }: { items: Array<{ question: string; answer: string; href?: string; linkLabel?: string }> }) {
  return <div className="divide-y divide-[#004e28]/15 border-y border-[#004e28]/15">
    {items.map((item) => <details key={item.question} className="group">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-[#173326] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] [&::-webkit-details-marker]:hidden">
        {item.question}<ChevronDown size={20} className="shrink-0 text-[#004e28] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-[#40554a] sm:text-base">
        <p>{item.answer}</p>
        {item.href && item.linkLabel ? <Link href={item.href} className="mt-2 inline-flex min-h-11 items-center font-semibold text-[#005c2e] underline underline-offset-4">{item.linkLabel}</Link> : null}
      </div>
    </details>)}
  </div>;
}

export function MarketingWhatsappButton({ href, onClick, className = "" }: { href: string; onClick: () => void; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label="Tengo una pregunta: abrir WhatsApp" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#004e28]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#004e28] shadow-sm transition-colors hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] ${className}`}>
    <MessageCircle size={18} aria-hidden="true" /><span>Tengo una pregunta</span>
  </a>;
}

export function MarketingStickyCta({ visible, href, onClick }: { visible: boolean; href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  if (!visible) return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#004e28]/15 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_26px_-20px_#004e28] md:hidden">
    <MarketingCta href={href} onClick={onClick} className="w-full" />
  </div>;
}
