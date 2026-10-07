import type { Metadata } from "next";
import { MarketingThankYou } from "@/components/marketing/MarketingThankYou";

export const metadata: Metadata = {
  title: { absolute: "Solicitud de menú recibida | Drooopy" },
  robots: { index: false, follow: false },
};

export default function MenuThankYouPage() {
  return <MarketingThankYou kind="menu" />;
}
