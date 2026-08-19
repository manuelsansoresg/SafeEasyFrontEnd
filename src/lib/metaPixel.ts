export type MetaStandardEvent =
  | "PageView"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Contact";

type MetaPixelWindow = Window & {
  fbq?: (
    action: "track" | "trackCustom",
    eventName: string,
    parameters?: Record<string, unknown>,
  ) => void;
};

export const trackMetaEvent = (
  eventName: MetaStandardEvent,
  parameters?: Record<string, unknown>,
) => {
  if (typeof window === "undefined") return;
  (window as MetaPixelWindow).fbq?.("track", eventName, parameters);
};

export const trackMetaCustomEvent = (
  eventName: string,
  parameters?: Record<string, unknown>,
) => {
  if (typeof window === "undefined") return;
  (window as MetaPixelWindow).fbq?.("trackCustom", eventName, parameters);
};

export const trackDirectoryInitiateCheckout = (planId: number, value: number) => {
  trackMetaEvent("InitiateCheckout", {
    content_name: "Plan Directorio",
    content_category: "Suscripción",
    content_ids: [String(planId)],
    currency: "MXN",
    value,
  });
};
