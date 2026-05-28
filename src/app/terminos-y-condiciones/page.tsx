import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PublicLegalPage } from "@/components/legal/PublicLegalPage";
import { getActiveLegalDocument } from "@/services/publicLegalService";

export const metadata: Metadata = {
  title: "Términos y condiciones | Drooopy",
  description: "Consulta los términos generales de uso de Drooopy.",
};

const sections = [
  {
    title: "Uso de la plataforma",
    text: "Drooopy facilita la conexión entre compradores y vendedores. Cada usuario debe usar la plataforma con información veraz, respetar las reglas de publicación y mantener sus datos actualizados.",
  },
  {
    title: "Publicaciones y catálogos",
    text: "Los vendedores son responsables de la información, disponibilidad, precios, imágenes y condiciones de sus productos o servicios publicados.",
  },
  {
    title: "Compras y pedidos",
    text: "Los compradores deben revisar los detalles de cada producto y confirmar sus datos antes de completar una compra o solicitar una entrega.",
  },
  {
    title: "Cuentas y seguridad",
    text: "Cada usuario es responsable de proteger su acceso, no compartir contraseñas y reportar cualquier actividad no reconocida.",
  },
  {
    title: "Cambios del servicio",
    text: "Drooopy puede ajustar funciones, contenidos o condiciones para mejorar la experiencia, cumplir obligaciones operativas o reforzar la seguridad.",
  },
];

export default async function TerminosYCondicionesPage() {
  const document = await getActiveLegalDocument("terms_and_conditions");

  return (
    <PublicLegalPage
      eyebrow="Términos y condiciones"
      heroTitle="Reglas claras para usar Drooopy."
      heroDescription="Esta sección resume los lineamientos generales de uso de la plataforma para compradores, vendedores y usuarios registrados."
      contactTitle="¿Tienes dudas sobre estos términos?"
      contactText="Puedes escribirnos desde la sección de contacto."
      contactLabel="Ir a contacto"
      icon={FileText}
      document={document}
      fallbackSections={sections}
    />
  );
}
