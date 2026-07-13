const FIELD_LABELS: Record<string, string> = {
  category_id: "categoría",
  description: "descripción",
  image: "imagen",
  is_active: "estado",
  price: "precio",
  sku: "SKU",
  slug: "slug",
  stock: "stock",
  subcategory_id: "subcategoría",
  supplier_id: "proveedor",
  title: "título",
};

const getFieldLabel = (loc: unknown): string | null => {
  if (!Array.isArray(loc)) return null;

  const field = loc
    .map((item) => String(item))
    .filter((item) => item !== "body" && item !== "query" && item !== "path")
    .at(-1);

  if (!field) return null;
  return FIELD_LABELS[field] || field.replaceAll("_", " ");
};

const translateValidationMessage = (message: string, fieldLabel: string | null) => {
  const normalized = message.trim().toLowerCase();
  const field = fieldLabel ? `El campo ${fieldLabel}` : "Este campo";

  if (normalized === "field required" || normalized.includes("field required")) {
    return `${field} es obligatorio.`;
  }

  if (normalized.includes("input should be a valid number")) {
    return `${field} debe ser un número válido.`;
  }

  if (normalized.includes("input should be a valid integer")) {
    return `${field} debe ser un número entero válido.`;
  }

  if (normalized.includes("input should be a valid string")) {
    return `${field} debe ser texto válido.`;
  }

  if (normalized.includes("input should be a valid boolean")) {
    return `${field} debe tener un valor válido.`;
  }

  if (normalized.includes("string should have at least")) {
    return `${field} es demasiado corto.`;
  }

  if (normalized.includes("string should have at most")) {
    return `${field} es demasiado largo.`;
  }

  if (normalized.includes("input should be greater than or equal to")) {
    return `${field} debe ser mayor o igual al mínimo permitido.`;
  }

  if (normalized.includes("input should be less than or equal to")) {
    return `${field} debe ser menor o igual al máximo permitido.`;
  }

  return fieldLabel ? `${field}: ${message}` : message;
};

const getDetailMessages = (detail: unknown): string[] => {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const message = typeof row.msg === "string" ? row.msg : "";
        const fieldLabel = getFieldLabel(row.loc);
        return message ? translateValidationMessage(message, fieldLabel) : "";
      })
      .filter(Boolean);
  }

  if (typeof detail === "string" && detail.trim()) {
    return [detail.trim()];
  }

  return [];
};

export const getSpanishErrorMessage = (
  payload: unknown,
  fallback = "Ocurrió un error. Intenta nuevamente."
) => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const detailMessages = getDetailMessages(record.detail);
  if (detailMessages.length > 0) {
    return detailMessages.join(" ");
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  return fallback;
};
