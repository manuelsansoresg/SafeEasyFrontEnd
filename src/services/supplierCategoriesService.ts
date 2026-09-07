import { fetchWithAuth } from "@/lib/api";
import type {
  CreateSupplierCategoryInput,
  DrooopyCategory,
  DrooopySubcategory,
  SupplierCategory,
  SupplierSubcategory,
  SupplierSubcategoryInput,
  UpdateSupplierSubcategoryInput,
  UpdateSupplierCategoryInput,
} from "@/types/supplierCategories";

export class SupplierCategoryRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierCategoryRequestError";
    this.status = status;
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function listOf<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = recordOf(payload);
  if (!record) return [];
  for (const key of ["items", "results", "data", ...keys]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

function messageFrom(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const messages = value.map(messageFrom).filter((item): item is string => Boolean(item));
    return messages.length ? messages.join(". ") : null;
  }
  const record = recordOf(value);
  return record ? messageFrom(record.detail ?? record.message ?? record.error ?? record.msg) : null;
}

async function request(
  url: string,
  options?: Parameters<typeof fetchWithAuth>[1],
  conflict: "category" | "subcategory" | "in-use" | "subcategory-in-use" = "in-use",
) {
  const response = await fetchWithAuth(url, { cache: "no-store", ...options });
  if (response.ok) return response;

  const payload: unknown = await response.json().catch(() => null);
  const backendMessage = messageFrom(payload);
  const message = response.status === 409
    ? conflict === "category"
      ? "Ya tienes una categoría con ese nombre."
      : conflict === "subcategory"
        ? "Ya tienes una subcategoría con ese nombre."
        : conflict === "subcategory-in-use"
          ? "No puedes eliminar esta subcategoría porque está en uso. Puedes desactivarla para conservar tu catálogo."
          : "No puedes eliminar esta categoría porque está en uso. Puedes desactivarla para conservar tus productos y servicios."
      : backendMessage || `No se pudo completar la solicitud (${response.status}). Inténtalo de nuevo.`;
  throw new SupplierCategoryRequestError(message, response.status);
}

function normalizeCategory(category: SupplierCategory): SupplierCategory {
  return {
    ...category,
    subcategory_id: category.subcategory_id ?? null,
    is_active: category.is_active !== false,
    subcategories: Array.isArray(category.subcategories) ? category.subcategories : [],
  };
}

function categoryFrom(payload: unknown) {
  const root = recordOf(payload);
  const category = recordOf(root?.data) ?? recordOf(root?.supplier_category) ?? root;
  return normalizeCategory(category as unknown as SupplierCategory);
}

function subcategoryFrom(payload: unknown) {
  const root = recordOf(payload);
  return (recordOf(root?.data) ?? recordOf(root?.supplier_subcategory) ?? root) as unknown as SupplierSubcategory;
}

export const supplierCategoriesService = {
  async list(supplierId: number, signal?: AbortSignal): Promise<SupplierCategory[]> {
    const response = await request(
      `/api/supplier-categories?supplier_id=${encodeURIComponent(String(supplierId))}`,
      { signal },
    );
    return listOf<SupplierCategory>(await response.json(), ["supplier_categories"])
      .map(normalizeCategory);
  },

  async create(input: CreateSupplierCategoryInput): Promise<SupplierCategory> {
    const response = await request("/api/supplier-categories", {
      method: "POST",
      body: JSON.stringify(input),
    }, "category");
    return categoryFrom(await response.json());
  },

  async update(id: number, input: UpdateSupplierCategoryInput): Promise<SupplierCategory> {
    const response = await request(`/api/supplier-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }, input.name === undefined ? "in-use" : "category");
    return categoryFrom(await response.json());
  },

  async delete(id: number): Promise<void> {
    await request(`/api/supplier-categories/${id}`, { method: "DELETE" });
  },

  async createSubcategory(categoryId: number, input: SupplierSubcategoryInput): Promise<SupplierSubcategory> {
    const response = await request(`/api/supplier-categories/${categoryId}/subcategories`, {
      method: "POST",
      body: JSON.stringify(input),
    }, "subcategory");
    return subcategoryFrom(await response.json());
  },

  async updateSubcategory(id: number, input: UpdateSupplierSubcategoryInput): Promise<SupplierSubcategory> {
    const response = await request(`/api/supplier-categories/subcategories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }, input.name === undefined ? "subcategory-in-use" : "subcategory");
    return subcategoryFrom(await response.json());
  },

  async deleteSubcategory(id: number): Promise<void> {
    await request(`/api/supplier-categories/subcategories/${id}`, { method: "DELETE" }, "subcategory-in-use");
  },

  async listGlobalCategories(signal?: AbortSignal): Promise<DrooopyCategory[]> {
    const response = await request("/api/categories/?skip=0&limit=100", { signal });
    return listOf<DrooopyCategory>(await response.json(), ["categories"])
      .filter((category) => category.is_active !== false)
      .map((category) => ({ ...category, subcategories: [] }));
  },

  async listGlobalSubcategories(categoryId: number, signal?: AbortSignal): Promise<DrooopySubcategory[]> {
    const response = await request(
      `/api/subcategories/?category_id=${encodeURIComponent(String(categoryId))}&skip=0&limit=1000`,
      { signal },
    );
    return listOf<DrooopySubcategory>(await response.json(), ["subcategories"])
      .filter((subcategory) => (
        subcategory.is_active !== false
        && Number(subcategory.category_id) === Number(categoryId)
      ));
  },
};
