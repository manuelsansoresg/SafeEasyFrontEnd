import type { LeadInterest, LeadPlan, LeadStatus } from "@/services/leads";

export const leadStatuses: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "Nuevo" },
  { value: "CONTACTED", label: "Contactado" },
  { value: "QUALIFIED", label: "Calificado" },
  { value: "WON", label: "Ganado" },
  { value: "LOST", label: "Perdido" },
];
export const leadInterests: { value: LeadInterest; label: string }[] = [
  { value: "DIRECTORY", label: "Directorio" },
  { value: "MENU", label: "Menú" },
  { value: "PRODUCTS", label: "Productos" },
  { value: "AGENDA", label: "Agenda" },
];
export const leadPlans: { value: LeadPlan; label: string }[] = [
  { value: "DIRECTORY", label: "Directorio" },
  { value: "STANDARD", label: "Estándar" },
  { value: "PROFESSIONAL", label: "Profesional" },
];

export const labelFor = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

export function formatLeadDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function whatsappUrl(phone: string, name: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.length === 10 ? `52${digits}` : digits;
  const message = `Hola ${name}, soy de Drooopy. Recibimos tu solicitud de información y me gustaría ayudarte.`;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
