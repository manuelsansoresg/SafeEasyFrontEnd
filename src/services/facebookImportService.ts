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
  connection_limit: "Tienes varias importaciones abiertas. Para continuar, pulsa «Cancelar importación» en otra pestaña donde la hayas iniciado. Si ya no la tienes abierta, espera hasta 30 minutos desde tu última conexión con Facebook y vuelve a intentarlo.",
  invalid_oauth_state: "La autorización venció o se abrió en otro navegador. Inicia de nuevo la conexión desde Drooopy.",
  meta_permission_denied: "Facebook no permitió leer la página. Vuelve a autorizarla y acepta los permisos solicitados.",
  meta_wrong_token: "La autorización de Facebook no corresponde a esta conexión. Vuelve a conectar tu cuenta.",
  meta_unavailable: "No pudimos comunicarnos con Facebook. Espera un momento e intenta de nuevo.",
  meta_request_failed: "Facebook no pudo completar la consulta. Intenta de nuevo o vuelve a autorizar la página.",
  meta_invalid_response: "Facebook devolvió una respuesta que no pudimos procesar. Intenta de nuevo.",
  meta_invalid_pagination: "No pudimos recuperar todas las páginas de Facebook. Intenta cargar la lista otra vez.",
  meta_page_limit: "La lista de páginas supera lo que podemos procesar. Autoriza menos páginas y vuelve a intentar.",
  preview_not_found: "Esta vista previa ya no está disponible. Selecciona la página otra vez para prepararla.",
  preview_images_expired: "Las imágenes de esta vista previa vencieron. Selecciona la página otra vez para recuperarlas.",
  image_changed_refresh_preview: "La imagen cambió en Facebook. Prepara otra vista previa antes de guardarla.",
  image_crop_out_of_bounds: "El recorte queda fuera de la imagen. Ajusta el encuadre o importa la imagen completa.",
  image_dimensions_not_allowed: "La imagen tiene dimensiones que no podemos procesar. Puedes continuar sin importarla.",
  image_invalid_content: "El archivo recibido no es una imagen válida. Puedes continuar sin importarlo.",
  image_not_available: "Esta imagen no está disponible. Conserva la actual o prepara otra vista previa.",
  image_origin_not_allowed: "No pudimos verificar el origen de la imagen. Puedes importar los datos sin esa imagen.",
  image_redirect_limit: "No pudimos acceder a la imagen de Facebook. Puedes continuar sin importarla.",
  image_too_large: "La imagen supera el tamaño permitido. Puedes continuar sin importarla.",
  image_unavailable: "No se pudo descargar la imagen. Intenta otra vez o conserva la actual.",
  ai_input_too_long: "Los textos son demasiado largos para la IA. Reduce su extensión o continúa sin IA.",
  ai_budget_exceeded: "Alcanzaste el límite de uso diario de IA. Puedes importar sin mejorar los textos.",
  ai_generation_in_progress: "Ya tienes una mejora de textos en curso. Espera su resultado antes de iniciar otra.",
  ai_idempotency_conflict: "La solicitud anterior corresponde a otros textos. Vuelve a iniciar la mejora con los textos actuales.",
  ai_request_interrupted: "No pudimos confirmar si la IA terminó. Puedes continuar sin IA o solicitar otra propuesta expresamente.",
  ai_preview_changed: "Cambiaste de página mientras se preparaban los textos. Solicita una propuesta para la página actual.",
  ai_provider_rate_limited: "El servicio de IA está ocupado. Espera un minuto antes de reintentar o continúa sin IA.",
  ai_invalid_output: "La propuesta de IA no pasó la revisión. Conservamos los originales; puedes reintentar o continuar sin IA.",
  ai_source_unavailable: "Los datos para mejorar los textos ya no están disponibles. Prepara otra vista previa.",
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
const fallbackMessage = "No se pudo completar la solicitud. Intenta de nuevo; si el problema continúa, contacta a soporte.";
function detail(value: unknown, status: number): string {
  if (typeof value === "string") return messages[value] || statusMessage(status);
  if (Array.isArray(value)) return "Hay datos que necesitan revisión. Comprueba los campos seleccionados, su longitud, las coordenadas y los horarios antes de guardar.";
  if (value && typeof value === "object") {
    const d = value as Record<string, unknown>;
    return detail(d.detail ?? d.code ?? d.msg ?? d.message ?? d.error_code, status);
  }
  return statusMessage(status);
}
function statusMessage(status: number): string {
  if (status === 401) return "Tu sesión venció. Inicia sesión en Drooopy para continuar.";
  if (status === 403) return "No tienes permiso para completar esta importación. Revisa tu acceso al negocio y a la página.";
  if (status === 404) return "No encontramos la conexión o el recurso solicitado. Vuelve a iniciar la importación; si persiste, contacta a soporte.";
  if (status === 422 || status === 400) return "Revisa los datos seleccionados antes de continuar.";
  if (status === 429) return "Se alcanzó un límite de solicitudes. Espera antes de intentar de nuevo.";
  if (status === 502 || status === 503 || status === 504) return "El servicio no está disponible en este momento. Intenta de nuevo más tarde.";
  return fallbackMessage;
}
function retryDelay(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (!raw) return;
  const seconds = /^\d+$/.test(raw.trim()) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
export class FacebookImportError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function importRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithAuth(base + path, { ...options, cache: "no-store", credentials: "include", headers: options.headers as Record<string, string> | undefined });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("No pudimos comunicarnos con el servidor. Revisa tu conexión a internet e intenta de nuevo.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const delay = retryDelay(response);
    const wait = delay ? ` El servidor indica que puedes reintentar en ${delay < 60 ? `${Math.ceil(delay)} segundos` : `${Math.ceil(delay / 60)} minutos`}.` : "";
    throw new FacebookImportError(response.status, data?.detail?.code || data?.error_code || "", detail(data, response.status) + wait);
  }
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
