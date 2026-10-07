import { getApiBaseUrl } from "@/lib/seo";
import { plansFromPayload } from "@/lib/marketingPlans";
import type { Plan } from "@/types/subscriptions";

const publicApiBases = () => Array.from(new Set([getApiBaseUrl(), "https://drooopy.com/api"]));

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

export async function getAgendaExampleDates(today: string): Promise<string[]> {
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 28);
  const query = new URLSearchParams({
    service_id: "18", date_from: today, date_to: max.toISOString().slice(0, 10),
  });
  for (const base of publicApiBases()) {
    try {
      const response = await fetch(`${base}/public/agenda/78/availability?${query}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const availability = await response.json() as Availability;
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: availability.timezone || "America/Merida",
        year: "numeric", month: "2-digit", day: "2-digit",
      });
      return Array.from(new Set((availability.slots ?? []).flatMap((slot) => {
        if (!slot.start_at) return [];
        const parts = formatter.formatToParts(new Date(slot.start_at));
        const value = (part: "year" | "month" | "day") => parts.find((item) => item.type === part)?.value ?? "";
        return [`${value("year")}-${value("month")}-${value("day")}`];
      })));
    } catch {
      // Try the public API when a local or internal endpoint is unavailable.
    }
  }
  return [];
}
