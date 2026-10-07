import type { Metadata } from "next";
import { MarketingThankYou } from "@/components/marketing/MarketingThankYou";

export const metadata: Metadata = {
  title: { absolute: "Solicitud de productos recibida | Drooopy" },
  robots: { index: false, follow: false },
};

export default function ProductsThankYouPage() {
  return <MarketingThankYou kind="products" />;
}
