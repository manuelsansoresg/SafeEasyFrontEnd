import type { CampaignKind } from "@/lib/marketingCampaign";

const MAX_AGE_MS = 60 * 60 * 1000;
const keyFor = (kind: CampaignKind) => `marketing_lead_confirmation_${kind}`;

export function saveMarketingLeadConfirmation(kind: CampaignKind, name: string) {
  try {
    sessionStorage.setItem(keyFor(kind), JSON.stringify({ name, createdAt: Date.now() }));
  } catch {
    // Personalization is optional; blocked storage must not stop navigation.
  }
}

export function readMarketingLeadConfirmation(kind: CampaignKind): string | null {
  try {
    const raw = sessionStorage.getItem(keyFor(kind));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { name, createdAt } = value as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || typeof createdAt !== "number" ||
      Date.now() - createdAt > MAX_AGE_MS || createdAt > Date.now()) {
      sessionStorage.removeItem(keyFor(kind));
      return null;
    }
    return name.trim();
  } catch {
    return null;
  }
}
