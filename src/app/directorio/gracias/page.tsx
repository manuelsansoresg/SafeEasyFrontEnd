import type { Metadata } from "next";
import { DirectoryThankYou } from "@/components/directorio/DirectoryThankYou";

export const metadata: Metadata = {
  title: "Pago confirmado | Directorio Drooopy",
  robots: { index: false, follow: false },
};

export default function DirectoryThankYouPage() {
  return <DirectoryThankYou />;
}
