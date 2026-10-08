import { MarketingLanding } from "@/components/marketing/MarketingLanding";
import { type NewLandingKind } from "@/lib/marketingPlans";
import { getAgendaExample, getMarketingPlans, type AgendaExample } from "@/lib/marketingPageData";

type SearchParams = Record<string, string | string[] | undefined>;

function todayInMerida() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Merida",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (part: "year" | "month" | "day") => parts.find((item) => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

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
  const today = todayInMerida();
  const [plans, agendaExample] = await Promise.all([
    getMarketingPlans(accessCode),
    kind === "agenda" ? getAgendaExample(today) : Promise.resolve<AgendaExample | null>(null),
  ]);

  return <MarketingLanding kind={kind} initialPlans={plans} campaignParams={campaignParams} today={today} agendaExample={agendaExample} />;
}
