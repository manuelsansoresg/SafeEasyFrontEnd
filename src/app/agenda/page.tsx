import type { Metadata } from "next";
import { AgendaMarketingLanding } from "@/components/marketing/AgendaMarketingLanding";
import { getMarketingPlans } from "@/lib/marketingPageData";
import { buildMetadata } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = buildMetadata({
  title: "Agenda de citas y reservaciones para negocios",
  description:
    "Organiza servicios, horarios y reservaciones en Drooopy. Facilita que tus clientes encuentren una fecha y un horario para reservar.",
  path: "/agenda",
});

export default async function AgendaLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const campaignParams: Array<[string, string]> = Object.entries(resolved).flatMap(
    ([key, value]): Array<[string, string]> => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) return value.map((entry) => [key, entry]);
      return [];
    },
  );
  const accessCode =
    typeof resolved.code === "string" ? resolved.code.trim() : "";
  const plans = await getMarketingPlans(accessCode);

  return (
    <AgendaMarketingLanding
      initialPlans={plans}
      campaignParams={campaignParams}
    />
  );
}
