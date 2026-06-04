import { fetchWithAuth } from "@/lib/api";

export type AuthUser = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
} | null;

export type CurrentSupplier = {
  id: number;
  name: string;
  slug?: string;
  short_name?: string;
  user_id?: number;
  email?: string;
  public_email?: string;
  mp_is_linked?: boolean;
  [key: string]: unknown;
};

type SupplierLookupOptions = {
  signal?: AbortSignal;
};

export function normalizeRole(role?: string | null) {
  return String(role || "").trim().toLowerCase();
}

export function isAdminRole(role?: string | null) {
  const key = normalizeRole(role);
  return key === "admin" || key === "superuser";
}

export function isSupplierRole(role?: string | null) {
  const key = normalizeRole(role);
  return key === "supplier" || key === "proveedor" || key === "provider" || key === "vendor";
}

export function getSupplierSlug(supplier: Pick<CurrentSupplier, "slug" | "short_name" | "name" | "id"> | null) {
  const slug = String(supplier?.slug || supplier?.short_name || "").trim();
  if (slug) return slug;
  const name = String(supplier?.name || "").trim();
  return name || (supplier?.id ? String(supplier.id) : "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function unwrapList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!asRecord(item));
  const record = asRecord(value);
  if (!record) return [];
  const candidates = [record.items, record.results, record.data, record.suppliers];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => !!asRecord(item));
    }
  }
  return [];
}

function asSupplier(value: unknown): CurrentSupplier | null {
  const record = asRecord(value);
  if (!record) return null;
  const nested = asRecord(record.supplier) || asRecord(record.data) || record;
  const id = toNumber(nested.id ?? nested.supplier_id ?? nested.supplierId);
  if (!id) return null;

  return {
    ...nested,
    id,
    name:
      toStringValue(nested.name) ||
      toStringValue(nested.short_name) ||
      toStringValue(nested.business_name) ||
      `Proveedor #${id}`,
    slug: toStringValue(nested.slug),
    short_name: toStringValue(nested.short_name),
    user_id: toNumber(nested.user_id ?? nested.userId) ?? undefined,
    email: toStringValue(nested.email),
    public_email: toStringValue(nested.public_email),
  };
}

function matchSupplierForUser(items: Record<string, unknown>[], user: NonNullable<AuthUser>) {
  const userId = Number(user.id);
  const email = String(user.email || "").trim().toLowerCase();

  const exactByUser = items.find((item) => toNumber(item.user_id ?? item.userId) === userId);
  if (exactByUser) return asSupplier(exactByUser);

  if (email) {
    const exactByEmail = items.find((item) => {
      const itemEmail = String(item.email ?? item.public_email ?? item.user_email ?? "").trim().toLowerCase();
      return itemEmail === email;
    });
    if (exactByEmail) return asSupplier(exactByEmail);
  }

  return items.length === 1 ? asSupplier(items[0]) : null;
}

async function readJson(url: string, options?: SupplierLookupOptions) {
  const response = await fetchWithAuth(url, {
    signal: options?.signal,
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function fetchSupplierById(id: number, options?: SupplierLookupOptions) {
  const data = await readJson(`/api/suppliers/${encodeURIComponent(String(id))}`, options);
  return asSupplier(data);
}

export async function resolveCurrentSupplier(user: AuthUser, options?: SupplierLookupOptions) {
  if (!user?.id) return null;

  const subscription = asRecord(await readJson("/api/subscriptions/my", options));
  const subscriptionSupplier = asSupplier(subscription?.supplier);
  if (subscriptionSupplier) {
    if (subscriptionSupplier.slug) return subscriptionSupplier;
    const fullSupplier = await fetchSupplierById(subscriptionSupplier.id, options);
    return fullSupplier ? { ...subscriptionSupplier, ...fullSupplier } : subscriptionSupplier;
  }

  const subscriptionSupplierId = toNumber(subscription?.supplier_id ?? subscription?.supplierId);
  if (subscriptionSupplierId) {
    const supplier = await fetchSupplierById(subscriptionSupplierId, options);
    if (supplier) return supplier;
  }

  const userId = encodeURIComponent(String(user.id));
  const supplierListUrls = [
    `/api/suppliers/?skip=0&limit=100&user_id=${userId}`,
    `/api/suppliers?skip=0&limit=100&user_id=${userId}`,
  ];

  for (const url of supplierListUrls) {
    const data = await readJson(url, options);
    const supplier = matchSupplierForUser(unwrapList(data), user);
    if (supplier) return supplier;
  }

  return null;
}
