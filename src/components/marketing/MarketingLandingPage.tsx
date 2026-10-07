import { MarketingLanding } from "@/components/marketing/MarketingLanding";
import { type NewLandingKind } from "@/lib/marketingPlans";
import { getAgendaExampleDates, getMarketingPlans } from "@/lib/marketingPageData";

type SearchParams = Record<string, string | string[] | undefined>;

export async function MarketingLandingPage({ kind, searchParams }: {
  kind: NewLandingKind;
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const campaignParams = Object.entries(resolved).flatMap(([key, value]) => {
    if (typeof value === "string") return [[key, value] as [string, string]];
    if (Array.isArray(value)) return value.map((item) => [key, item] as [string, string]);
    return [];
  });
  const accessCode = typeof resolved.code === "string" ? resolved.code.trim() : "";
  const today = new Date().toISOString().slice(0, 10);
  const [plans, agendaDates] = await Promise.all([
    getMarketingPlans(accessCode),
    kind === "agenda" ? getAgendaExampleDates(today) : Promise.resolve([]),
  ]);

  return <MarketingLanding kind={kind} initialPlans={plans} campaignParams={campaignParams} today={today} agendaDates={agendaDates} />;
}
