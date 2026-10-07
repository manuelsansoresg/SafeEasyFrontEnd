import type { Metadata } from "next";
import { DirectoryThankYou } from "@/components/directorio/DirectoryThankYou";

export const metadata: Metadata = {
  title: { absolute: "Solicitud recibida | Drooopy" },
  robots: { index: false, follow: false },
};

export default function DirectoryThankYouPage() {
  return <DirectoryThankYou />;
}
