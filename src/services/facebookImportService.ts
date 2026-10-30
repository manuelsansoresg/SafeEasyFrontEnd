import { fetchWithAuth } from "@/lib/api";

export type ImportFields = Partial<Record<"name" | "short_description" | "description" | "title_about" | "subtitle_about" | "about" | "phone" | "address" | "country" | "state" | "city" | "cp" | "facebook_url", string>> & { latitude?: number; longitude?: number };
export type FieldKey = keyof ImportFields;
export type BusinessHour = { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean };
export type Crop = { x: number; y: number; width: number; height: number };
export type ImageChoice = { action: "keep" | "import"; crop?: Crop };
export type Preview = {
  preview_id: string; page_id: string; fields: ImportFields;
  current: Partial<Record<FieldKey, string | number | null>>;
  current_images: { logo: string | null; banner: string | null };
  current_map_location: string | null;
  images: Partial<Record<"logo" | "banner", { width: number; height: number; path: string }>>;
  business_hours: BusinessHour[]; current_business_hours: BusinessHour[];
  category_suggestions: { source_id: string; name: string }[]; warnings: string[];
};
export type Connection = { connection_id: string; supplier_id: number; status: string; expires_at: string };
export type FacebookPage = { id: string; name: string | null; photo_path: string | null };
export type Proposal = { status: "processing" | "succeeded" | "failed" | "unknown"; proposal: Partial<ImportFields> | null; error_code?: string; retry_after_seconds?: number; warnings: string[] };
// Production routes /api directly to FastAPI. /api/backend is a Next-only
// alias and is not available behind that ingress. Use the public contract;
// Next's generic API handler supports the same path in local development.
const base = "/api/integrations/facebook/connections";
const part = encodeURIComponent;
const messages: Record<string, string> = {
  facebook_not_configured: "La conexión con Facebook aún no está configurada. Intenta más tarde.",
  connection_expired: "La conexión venció. Conserva tus textos y vuelve a conectar Facebook.",
  connection_not_found: "Esta conexión ya no está disponible. Vuelve a conectar Facebook.",
  connection_not_ready: "La conexión no está lista o ya se utilizó. Comprueba su estado antes de continuar.",
  meta_reconnect_required: "Facebook necesita que vuelvas a autorizar la conexión.",
  meta_permissions_missing: "Faltan permisos de Facebook. Conecta de nuevo y autoriza la página.",
  page_not_authorized: "Esta página no está autorizada. Vuelve a conectar Facebook.",
  geo_review_required: "Revisa juntos país, estado y ciudad, o desmarca esos campos para conservar la ubicación actual.",
  ai_not_configured: "La mejora de textos no está disponible. Puedes importar sin IA.",
  ai_daily_limit: "Alcanzaste el límite diario de IA. Puedes importar los textos originales.",
  ai_rate_limited: "Espera un momento antes de volver a mejorar los textos.",
  ai_insufficient_input: "Añade detalles del negocio a los textos antes de pedir una mejora.",
  ai_provider_timeout: "La IA no confirmó el resultado. Puedes continuar sin IA o reintentar expresamente.",
  ai_provider_unavailable: "La IA no está disponible. Tus datos originales se conservan.",
  supplier_conflict: "Ya existe un negocio con ese nombre. Revisa el nombre antes de guardar.",
};
function detail(value: unknown): string {
  if (typeof value === "string") return messages[value] || value;
  if (Array.isArray(value)) return value.map(detail).join(". ");
  if (value && typeof value === "object") {
    const d = value as Record<string, unknown>;
    return detail(d.detail ?? d.code ?? d.msg ?? d.message ?? d.error_code);
  }
  return "No se pudo completar la solicitud. Intenta de nuevo.";
}
export class FacebookImportError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function importRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(base + path, { ...options, cache: "no-store", credentials: "include", headers: options.headers as Record<string, string> | undefined });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new FacebookImportError(response.status, data?.detail?.code || data?.error_code || "", detail(data));
  return data as T;
}
export const connectionPath = (id: string) => `/${part(id)}`;
export async function importImage(path: string, signal: AbortSignal): Promise<Blob> {
  // Only attach Drooopy credentials to the documented private image endpoints.
  if (!/^\/api\/integrations\/facebook\/connections\/[a-zA-Z0-9_-]+\/(pages\/[0-9]+\/photo|previews\/[a-zA-Z0-9_-]+\/images\/(logo|banner))$/.test(path)) throw new Error("Imagen no disponible");
  const response = await fetchWithAuth(path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar la imagen");
  return response.blob();
}
