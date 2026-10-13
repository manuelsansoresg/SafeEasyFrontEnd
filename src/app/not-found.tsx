import type { Metadata } from "next";

// Next.js adds a noindex tag for notFound(); clear the root page's index and
// canonical metadata so the 404 response does not contain conflicting signals.
export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La página solicitada no está disponible en Drooopy.",
  alternates: { canonical: null },
  robots: null,
  openGraph: null,
  twitter: null,
};

export default function NotFound() {
  return null;
}
