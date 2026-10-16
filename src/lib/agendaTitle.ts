export type AgendaBusinessType = string | {
  name?: string | null;
  slug?: string | null;
  title?: string | null;
  label?: string | null;
};

export const AGENDA_TITLE_OPTIONS = [
  "Reserva tu mesa",
  "Agenda tu cita",
  "Agenda tu consulta",
  "Agenda una visita",
  "Reserva tu clase",
  "Reserva tu lugar",
  "Haz una reservación",
] as const;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function suggestedAgendaTitle(
  businessType?: AgendaBusinessType | null,
) {
  const type = normalize(typeof businessType === "string"
    ? businessType
    : businessType?.slug || businessType?.name || businessType?.title || businessType?.label || "");
  if (type === "restaurantes" || type === "restaurante") return "Reserva tu mesa";
  if (type === "profesionales" || type === "profesional") return "Agenda tu cita";
  if (type === "inmuebles" || type === "inmueble") return "Agenda una visita";
  return "Haz una reservación";
}

export function publicAgendaTitle(
  savedTitle: string | null | undefined,
  businessType?: AgendaBusinessType | null,
) {
  return savedTitle?.trim() || suggestedAgendaTitle(businessType);
}
