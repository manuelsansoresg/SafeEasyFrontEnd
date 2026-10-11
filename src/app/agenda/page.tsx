import type { Metadata } from "next";
import { AgendaMarketingLanding } from "@/components/marketing/AgendaMarketingLanding";
import { getAgendaExample, getMarketingPlans } from "@/lib/marketingPageData";
import { buildMetadata } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

const initialScrollGuard = `
  if (document.readyState === "loading" && !location.hash) {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (navigation && navigation.type === "navigate" && "scrollRestoration" in history) {
      const previous = history.scrollRestoration;
      history.scrollRestoration = "manual";
      scrollTo(0, 0);
      const events = ["pointerdown", "touchstart", "wheel", "keydown", "pagehide"];
      const restore = () => {
        history.scrollRestoration = previous;
        events.forEach((event) => window.removeEventListener(event, restore));
      };
      events.forEach((event) => window.addEventListener(event, restore, { once: true }));
    }
  }
`;

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
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type: "year" | "month" | "day") =>
    dateParts.find((part) => part.type === type)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const [plans, agendaExample] = await Promise.all([
    getMarketingPlans(accessCode),
    getAgendaExample(today),
  ]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: initialScrollGuard }} />
      <AgendaMarketingLanding
        initialPlans={plans}
        campaignParams={campaignParams}
        today={today}
        agendaExample={agendaExample}
      />
    </>
  );
}
