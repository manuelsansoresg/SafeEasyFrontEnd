import { getApiBaseUrl } from "@/lib/seo";
import { plansFromPayload } from "@/lib/marketingPlans";
import type { Plan } from "@/types/subscriptions";
import type { AgendaService } from "@/types/agenda";

const publicApiBases = () => Array.from(new Set([getApiBaseUrl(), "https://drooopy.com/api"]));
export const AGENDA_MARKETING_EXAMPLE = { supplierId: 78, serviceId: 18 } as const;

export type AgendaExample = {
  service: AgendaService | null;
  timezone: string;
  dates: string[];
  selectedDate: string | null;
  slots: string[];
};

export async function getMarketingPlans(accessCode: string): Promise<Plan[]> {
  const params = new URLSearchParams({ skip: "0", limit: "1000", only_active: "true" });
  if (accessCode) {
    params.set("access_code", accessCode);
    params.set("is_demo", "true");
  } else {
    params.set("is_listed", "true");
    params.set("is_demo", "false");
  }
  for (const base of publicApiBases()) {
    try {
      const response = await fetch(`${base}/plans/?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) return plansFromPayload(await response.json() as unknown);
    } catch {
      // A local API can be unavailable while the public API remains reachable.
    }
  }
  return [];
}

type Availability = { timezone?: string; slots?: Array<{ start_at?: string }> };

export async function getAgendaExample(today: string): Promise<AgendaExample> {
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 28);
  const query = new URLSearchParams({
    service_id: String(AGENDA_MARKETING_EXAMPLE.serviceId), date_from: today, date_to: max.toISOString().slice(0, 10),
  });
  let service: AgendaService | null = null;
  let availability: Availability | null = null;
  for (const base of publicApiBases()) {
    try {
      const response = await fetch(`${base}/public/agenda/${AGENDA_MARKETING_EXAMPLE.supplierId}/services`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const services = await response.json() as AgendaService[];
      if (!Array.isArray(services)) continue;
      service = services.find((item) => item.id === AGENDA_MARKETING_EXAMPLE.serviceId && item.is_active) ?? null;
      break;
    } catch {
      // Continue with the public API if the first source is unavailable.
    }
  }
  if (service) for (const base of publicApiBases()) {
    try {
      const response = await fetch(`${base}/public/agenda/${AGENDA_MARKETING_EXAMPLE.supplierId}/availability?${query}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      availability = await response.json() as Availability;
      break;
    } catch {
      // Keep the service visible even if availability cannot be loaded.
    }
  }
  let timezone = availability?.timezone || "America/Merida";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); }
  catch { timezone = "America/Merida"; }
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const byDate = new Map<string, string[]>();
  for (const slot of availability?.slots ?? []) {
    if (!slot.start_at || Number.isNaN(Date.parse(slot.start_at))) continue;
    const parts = formatter.formatToParts(new Date(slot.start_at));
    const value = (part: "year" | "month" | "day") => parts.find((item) => item.type === part)?.value ?? "";
    const date = `${value("year")}-${value("month")}-${value("day")}`;
    if (date < today) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), slot.start_at]);
  }
  const dates = [...byDate.keys()].sort();
  const selectedDate = dates[0] ?? null;
  return { service, timezone, dates, selectedDate, slots: selectedDate ? byDate.get(selectedDate) ?? [] : [] };
}
