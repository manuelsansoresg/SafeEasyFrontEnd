"use client";

import { type FormEvent, useRef, useState } from "react";
import { Check, MessageCircle } from "lucide-react";

type Props = {
  onLeadCreated: () => void;
  onWhatsappClick: () => void;
};

const WHATSAPP_AFTER_LEAD = `https://wa.me/529992685617?text=${encodeURIComponent(
  "Hola, envié mis datos desde Drooopy y quiero más información para publicar mi negocio.",
)}`;

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-[#004e28]/20 bg-white px-4 py-3 text-base text-[#17251c] outline-none placeholder:text-[#67796c] focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/20";

export function DirectoryLeadForm({ onLeadCreated, onWhatsappClick }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const inFlight = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (inFlight.current) return;
    if (!trimmedName || !trimmedPhone) {
      setError("Ingresa tu nombre y WhatsApp.");
      return;
    }

    inFlight.current = true;
    setSending(true);
    setError("");
    const params = new URLSearchParams(window.location.search);
    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      ...(businessName.trim() ? { business_name: businessName.trim() } : {}),
      interest: "DIRECTORY",
      landing_path: window.location.pathname,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      gclid: params.get("gclid"),
      fbclid: params.get("fbclid"),
      referrer: document.referrer || null,
    };

    try {
      const response = await fetch("/api/backend/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Lead request failed: ${response.status}`);
      setConfirmedName(trimmedName);
      onLeadCreated();
    } catch {
      setError("No pudimos enviar tus datos. Intenta nuevamente.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (confirmedName) {
    return (
      <div className="rounded-[1.5rem] border border-[#004e28]/12 bg-white p-6 shadow-[0_20px_60px_-45px_rgba(0,78,40,0.35)] sm:p-8" role="status" aria-live="polite">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e5f3e0] text-[#168e00]"><Check size={24} aria-hidden="true" /></span>
        <h3 className="mt-5 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">¡Gracias, {confirmedName}!</h3>
        <p className="mt-3 text-sm leading-6 text-[#40554a]">Recibimos tus datos. Nos pondremos en contacto contigo.</p>
        <p className="mt-4 text-sm font-semibold text-[#004e28]">¿Prefieres continuar ahora?</p>
        <div className="mt-4">
          <a href={WHATSAPP_AFTER_LEAD} target="_blank" rel="noopener noreferrer" onClick={onWhatsappClick} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#004e28] px-5 py-3 text-sm font-semibold text-[#004e28] hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28]"><MessageCircle size={18} aria-hidden="true" />Continuar por WhatsApp</a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] border border-[#004e28]/12 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,78,40,0.35)] sm:p-8">
      <div className="grid gap-4">
        <label className="block text-sm font-semibold text-[#173326]">Nombre <span aria-hidden="true">*</span>
          <input className={inputClass} type="text" name="name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-[#173326]">WhatsApp <span aria-hidden="true">*</span>
          <input className={inputClass} type="tel" name="phone" autoComplete="tel" inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-[#173326]">Nombre del negocio <span className="font-normal text-[#5f7164]">(opcional)</span>
          <input className={inputClass} type="text" name="business_name" autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={sending} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#168e00] px-6 py-3 text-sm font-bold text-white hover:bg-[#116f04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] disabled:cursor-wait disabled:opacity-65 sm:text-base">{sending ? "Enviando..." : "Quiero información"}</button>
      {error ? <p role="alert" aria-live="assertive" className="mt-3 text-sm font-medium text-[#a52717]">{error}</p> : null}
      <p className="mt-3 text-center text-xs text-[#5f7164]">Usaremos tus datos para contactarte sobre Drooopy.</p>
    </form>
  );
}
