import type { LeadInterest } from "@/services/leads";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/metaPixel";

export type CampaignKind = "directory" | "menu" | "products" | "agenda";
export type CampaignAction = "view" | "cta_click" | "lead_created" | "whatsapp_click" | "thank_you_view";

export const campaignSettings: Record<CampaignKind, {
  path: string;
  interest: LeadInterest;
  whatsappQuestion: string;
  whatsappAfterLead: string;
  thankYouEyebrow: string;
}> = {
  directory: {
    path: "/directorio",
    interest: "DIRECTORY",
    whatsappQuestion: "Hola, vi Drooopy y quiero información para publicar mi negocio.",
    whatsappAfterLead: "Hola, envié mis datos desde Drooopy y quiero más información para publicar mi negocio.",
    thankYouEyebrow: "Solicitud recibida",
  },
  menu: {
    path: "/menu",
    interest: "MENU",
    whatsappQuestion: "Hola, vi Drooopy y quiero información para mostrar el menú de mi negocio.",
    whatsappAfterLead: "Hola, envié mis datos desde Drooopy y quiero información sobre el menú para mi negocio.",
    thankYouEyebrow: "Solicitud sobre menú recibida",
  },
  products: {
    path: "/vender",
    interest: "PRODUCTS",
    whatsappQuestion: "Hola, vi Drooopy y quiero información para mostrar y vender mis productos.",
    whatsappAfterLead: "Hola, envié mis datos desde Drooopy y quiero información para vender mis productos.",
    thankYouEyebrow: "Solicitud sobre productos recibida",
  },
  agenda: {
    path: "/agenda",
    interest: "AGENDA",
    whatsappQuestion: "Hola, vi Drooopy y quiero información para recibir citas o reservaciones en mi negocio.",
    whatsappAfterLead: "Hola, envié mis datos desde Drooopy y quiero información sobre la agenda para mi negocio.",
    thankYouEyebrow: "Solicitud sobre agenda recibida",
  },
};

type AnalyticsWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

export function campaignWhatsAppUrl(kind: CampaignKind, afterLead = false) {
  const message = afterLead
    ? campaignSettings[kind].whatsappAfterLead
    : campaignSettings[kind].whatsappQuestion;
  return `https://wa.me/529992685617?text=${encodeURIComponent(message)}`;
}

export function emitCampaignEvent(kind: CampaignKind, action: CampaignAction, placement?: string) {
  if (typeof window === "undefined") return;
  const detail = { event: `${kind}_${action}`, placement, path: window.location.pathname };
  window.dispatchEvent(new CustomEvent("drooopy:marketing", { detail }));
  ((window as AnalyticsWindow).dataLayer ??= []).push(detail);

  if (action === "cta_click") {
    const label = kind === "directory" ? "Directory" : kind.charAt(0).toUpperCase() + kind.slice(1);
    trackMetaCustomEvent(`${label}CtaClick`, { placement });
  }
  const label = { directory: "Directorio", menu: "Menú", products: "Productos", agenda: "Agenda" }[kind];
  if (action === "whatsapp_click") trackMetaEvent("Contact", { content_name: `WhatsApp ${label}` });
  if (action === "lead_created") trackMetaEvent("Lead", { content_name: `${label} Drooopy` });
}
