"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { campaignSettings, type CampaignKind } from "@/lib/marketingCampaign";
import { saveMarketingLeadConfirmation } from "@/lib/marketingLeadConfirmation";

const CAMPAIGN_PARAMETERS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
const LEAD_ENDPOINT = process.env.NODE_ENV === "production"
  ? "/api/public/leads"
  : "/api/backend/public/leads/";
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#004e28]/20 bg-white px-4 py-3 text-base text-[#17251c] outline-none placeholder:text-[#67796c] focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/20";
type LeadCreatedResponse = { success: boolean; created?: boolean };

export function MarketingLeadForm({ kind, onLeadCreated, submitLabel = "Quiero información" }: { kind: CampaignKind; onLeadCreated: () => void; submitLabel?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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
    const normalizedPhone = trimmedPhone.replace(/[()\s-]/g, "");
    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
      setError("Ingresa un WhatsApp válido de 7 a 15 dígitos.");
      return;
    }

    inFlight.current = true;
    setSending(true);
    setError("");
    const params = new URLSearchParams(window.location.search);
    const payload = {
      name: trimmedName,
      phone: normalizedPhone,
      ...(businessName.trim() ? { business_name: businessName.trim() } : {}),
      interest: campaignSettings[kind].interest,
      landing_path: campaignSettings[kind].path,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      gclid: params.get("gclid"),
      fbclid: params.get("fbclid"),
      referrer: document.referrer || null,
    };

    let created = false;
    try {
      const response = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Lead request failed: ${response.status}`);
      const result = await response.json() as LeadCreatedResponse;
      if (result.success !== true) throw new Error("Invalid lead response");
      created = result.created === true;
    } catch {
      setError("No pudimos enviar tus datos. Intenta nuevamente.");
      inFlight.current = false;
      setSending(false);
      return;
    }

    if (created) onLeadCreated();
    saveMarketingLeadConfirmation(kind, trimmedName);
    const campaign = new URLSearchParams();
    for (const key of CAMPAIGN_PARAMETERS) {
      const value = params.get(key);
      if (value) campaign.set(key, value);
    }
    const query = campaign.toString();
    router.push(`${campaignSettings[kind].path}/gracias${query ? `?${query}` : ""}`);
  };

  return (
    <form onSubmit={submit} autoComplete="off" className="rounded-[1.5rem] border border-[#004e28]/12 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,78,40,0.35)] sm:p-8">
      <div className="grid gap-4">
        <label className="block text-sm font-semibold text-[#173326]">Nombre <span aria-hidden="true">*</span>
          <input className={inputClass} type="text" name="name" autoComplete="off" maxLength={150} required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-[#173326]">WhatsApp <span aria-hidden="true">*</span>
          <input className={inputClass} type="tel" name="phone" autoComplete="off" inputMode="tel" required aria-invalid={error.startsWith("Ingresa un WhatsApp válido") || undefined} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-[#173326]">Nombre del negocio <span className="font-normal text-[#5f7164]">(opcional)</span>
          <input className={inputClass} type="text" name="business_name" autoComplete="organization" maxLength={150} value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={sending} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#158900] px-6 py-3 text-sm font-bold text-white hover:bg-[#116f04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] disabled:cursor-wait disabled:opacity-65 sm:text-base">{sending ? "Enviando..." : submitLabel}</button>
      {error ? <p role="alert" aria-live="assertive" className="mt-3 text-sm font-medium text-[#a52717]">{error}</p> : null}
      <p className="mt-3 text-center text-xs text-[#5f7164]">Usaremos tus datos para contactarte sobre Drooopy.</p>
    </form>
  );
}
