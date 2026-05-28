import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { PublicLegalPage } from "@/components/legal/PublicLegalPage";
import { getActiveLegalDocument } from "@/services/publicLegalService";

export const metadata: Metadata = {
  title: "Política de privacidad | Drooopy",
  description: "Conoce cómo Drooopy maneja la privacidad y protección de datos de sus usuarios.",
};

const sections = [
  {
    title: "Datos de cuenta",
    text: "Podemos solicitar datos como nombre, correo, teléfono, dirección o información de empresa para crear cuentas, operar pedidos y mantener la comunicación necesaria.",
  },
  {
    title: "Uso de información",
    text: "La información se utiliza para brindar acceso a la plataforma, procesar operaciones, mejorar la experiencia y prevenir usos indebidos.",
  },
  {
    title: "Comunicación",
    text: "Podemos enviar notificaciones relacionadas con pedidos, cuenta, seguridad o cambios importantes en el servicio.",
  },
  {
    title: "Protección",
    text: "Aplicamos medidas razonables para proteger la información y recomendamos a cada usuario mantener sus accesos seguros.",
  },
  {
    title: "Derechos del usuario",
    text: "Los usuarios pueden solicitar orientación sobre sus datos personales a través de los canales de contacto disponibles.",
  },
];

export default async function PoliticasDePrivacidadPage() {
  const document = await getActiveLegalDocument("privacy_policy");

  return (
    <PublicLegalPage
      eyebrow="Política de privacidad"
      heroTitle="Cuidamos la información que hace funcionar tu experiencia."
      heroDescription="Esta página explica de forma general cómo se usan los datos dentro de Drooopy para operar cuentas, pedidos, catálogos y soporte."
      contactTitle="¿Quieres consultar algo sobre privacidad?"
      contactText="Escríbenos desde contacto para recibir orientación."
      contactLabel="Contacto"
      icon={LockKeyhole}
      document={document}
      fallbackSections={sections}
    />
  );
}
