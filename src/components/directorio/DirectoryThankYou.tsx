"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, LayoutDashboard, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useSyncExternalStore } from "react";
import { readDirectoryCheckoutContext } from "@/lib/directoryCheckoutCampaign";

const subscribeToDirectoryContext = () => () => {};

export function DirectoryThankYou() {
  const email = useSyncExternalStore<string | null | undefined>(
    subscribeToDirectoryContext,
    () => {
      const context = readDirectoryCheckoutContext();
      return context?.confirmed ? context.email : null;
    },
    () => undefined,
  );

  if (email === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] px-4">
        <p className="text-sm font-semibold text-[#607068]">Preparando la confirmación…</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] px-4 py-12">
        <section className="w-full max-w-xl rounded-[2rem] border border-[#004e28]/10 bg-white p-8 text-center shadow-[0_24px_80px_-42px_rgba(0,78,40,0.55)] sm:p-12">
          <h1 className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">No encontramos una compra reciente</h1>
          <p className="mt-4 text-sm leading-7 text-[#607068]">Esta página se muestra después de confirmar el pago del Plan Directorio.</p>
          <Link href="/directorio" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#168e00] px-7 font-bold text-white transition hover:bg-[#117600]">
            Volver al Directorio
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#004e28] px-4 py-10 sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(126,217,87,0.24),transparent_28%),radial-gradient(circle_at_90%_85%,rgba(255,255,255,0.14),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[2.25rem] bg-white px-6 py-9 shadow-[0_35px_100px_-40px_rgba(0,0,0,0.75)] sm:px-12 sm:py-12">
          <div className="absolute right-0 top-0 h-36 w-36 translate-x-12 -translate-y-12 rounded-full bg-[#b9efaa]/35" aria-hidden="true" />

          <Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" width={176} height={52} className="h-auto w-36" priority />

          <div className="mt-9 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9f6e6] text-[#168e00] shadow-[0_14px_35px_-22px_rgba(22,142,0,0.9)]">
            <Check size={34} strokeWidth={3} aria-hidden="true" />
          </div>

          <div className="mt-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">
              <Sparkles size={15} aria-hidden="true" /> Pago confirmado
            </div>
            <h1 className="mt-3 text-balance font-[family-name:var(--font-varela-round)] text-3xl leading-tight text-[#004e28] sm:text-5xl">
              ¡Listo! Tu negocio ya forma parte de Drooopy 🎉
            </h1>
            <p className="mt-5 text-base leading-7 text-[#526359] sm:text-lg">Recibimos correctamente tu pago y creamos tu cuenta.</p>
          </div>

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#004e28]/10 bg-[#f5f8f5] p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#004e28] shadow-sm">
              <Mail size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Correo de acceso</p>
              <p className="mt-1 break-all font-semibold text-[#173326]">{email}</p>
            </div>
          </div>

          <div className="mt-7 space-y-5 text-sm leading-7 text-[#526359] sm:text-base">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 shrink-0 text-[#168e00]" size={19} aria-hidden="true" />
              <p>Te enviamos un correo para que establezcas tu contraseña y puedas ingresar a tu panel.</p>
            </div>
            <div className="flex items-start gap-3">
              <LayoutDashboard className="mt-1 shrink-0 text-[#168e00]" size={19} aria-hidden="true" />
              <p>Desde ahí podrás completar la información de tu negocio, agregar servicios, imágenes, horarios, ubicación y formas de contacto.</p>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-1 shrink-0 text-[#168e00]" size={19} aria-hidden="true" />
              <p>También nos comunicaremos contigo por WhatsApp para ayudarte con la configuración inicial.</p>
            </div>
          </div>

          <Link href="/admin/dashboard" className="mt-9 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#168e00] px-7 font-bold text-white shadow-[0_14px_30px_-16px_rgba(22,142,0,0.9)] transition hover:-translate-y-0.5 hover:bg-[#117600] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#168e00] sm:w-auto">
            Ir a mi panel
          </Link>
        </section>
      </div>
    </main>
  );
}
