"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { campaignSettings, campaignWhatsAppUrl, emitCampaignEvent, type CampaignKind } from "@/lib/marketingCampaign";
import { readMarketingLeadConfirmation } from "@/lib/marketingLeadConfirmation";

const subscribe = () => () => {};

export function MarketingThankYou({ kind }: { kind: CampaignKind }) {
  const name = useSyncExternalStore(subscribe, () => readMarketingLeadConfirmation(kind), () => null);
  const trackedView = useRef(false);

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    emitCampaignEvent(kind, "thank_you_view");
  }, [kind]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f2f3f4] px-4 py-8 sm:px-6 sm:py-12">
      <section className="w-full max-w-[650px] rounded-[1.75rem] border border-[#004e28]/10 bg-white px-6 py-8 text-center shadow-[0_24px_70px_-44px_rgba(0,78,40,0.38)] sm:px-12 sm:py-11">
        <Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" width={148} height={44} priority className="mx-auto h-auto w-32 sm:w-36" />
        <div className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5e5] text-[#168e00] sm:mt-8" aria-hidden="true">
          <Check size={30} strokeWidth={3} />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#116f04]">{campaignSettings[kind].thankYouEyebrow}</p>
        <h1 className="mt-3 break-words text-balance font-[family-name:var(--font-varela-round)] text-3xl leading-tight text-[#004e28] sm:text-4xl">
          ¡Gracias{name ? `, ${name}` : ""}!
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#34483b]">
          {name
            ? "Recibimos tus datos y nos pondremos en contacto contigo."
            : "Si enviaste tus datos desde Drooopy, ya recibimos tu solicitud y nos pondremos en contacto contigo."}
        </p>
        <div className="mx-auto mt-7 max-w-sm border-t border-[#004e28]/10 pt-6 sm:mt-8">
          <p className="text-sm font-semibold text-[#004e28]">¿Quieres hablar con nosotros ahora?</p>
          <a
            href={campaignWhatsAppUrl(kind, true)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => emitCampaignEvent(kind, "whatsapp_click", "thank_you")}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#158900] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#116f04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#004e28] sm:text-base"
          >
            <MessageCircle size={19} aria-hidden="true" />
            Continuar por WhatsApp
          </a>
          <Link href="/" className="mt-5 inline-flex min-h-10 items-center justify-center text-sm font-semibold text-[#004e28] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28]">
            Volver a Drooopy
          </Link>
        </div>
      </section>
    </main>
  );
}
