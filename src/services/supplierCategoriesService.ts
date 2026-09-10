import { fetchWithAuth } from "@/lib/api";

import type {
  CreateGlobalSupplierSubcategoryInput,
  CreateSupplierCategoryInput,
  DrooopyCategory,
  DrooopySubcategory,
  SupplierCategory,
  SupplierSubcategory,
  SupplierSubcategoryInput,
  UpdateSupplierCategoryInput,
  UpdateSupplierSubcategoryInput,
} from "@/types/supplierCategories";

export class SupplierCategoryRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierCategoryRequestError";
    this.status = status;
  }
}

function recordOf(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function listOf<T>(
  payload: unknown,
  keys: string[],
): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const record = recordOf(payload);

  if (!record) {
    return [];
  }

  for (const key of [
    "items",
    "results",
    "data",
    ...keys,
  ]) {
    if (Array.isArray(record[key])) {
      return record[key] as T[];
    }
  }

  return [];
}

function messageFrom(
  value: unknown,
): string | null {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const messages = value
      .map(messageFrom)
      .filter(
        (item): item is string =>
          Boolean(item),
      );

    return messages.length
      ? messages.join(". ")
      : null;
  }

  const record = recordOf(value);

  if (!record) {
    return null;
  }

  return messageFrom(
    record.detail ??
      record.message ??
      record.error ??
      record.msg,
  );
}

function translateConflict(
  backendMessage: string | null,
) {
  switch (backendMessage) {
    case "Supplier category already exists":
      return "Ya tienes una categoría con ese nombre.";

    case "Supplier subcategory already exists":
      return "Ya tienes una subcategoría con ese nombre.";

    case "Supplier category is currently in use":
      return "No puedes eliminar esta categoría porque está siendo utilizada por un producto o servicio. Puedes desactivarla.";

    case "Supplier subcategory is currently in use":
      return "No puedes eliminar esta subcategoría porque está siendo utilizada por un producto o servicio. Puedes desactivarla.";

    default:
      return (
        backendMessage ??
        "No se pudo completar la operación porque el registro está en uso."
      );
  }
}

async function request(
  url: string,
  options?: Parameters<
    typeof fetchWithAuth
  >[1],
) {
  const response = await fetchWithAuth(
    url,
    {
      cache: "no-store",
      ...options,
    },
  );

  if (response.ok) {
    return response;
  }

  const payload: unknown =
    await response
      .json()
      .catch(() => null);

  const backendMessage =
    messageFrom(payload);

  let message: string;

  if (response.status === 409) {
    message =
      translateConflict(
        backendMessage,
      );
  } else {
    message =
      backendMessage ??
      `No se pudo completar la solicitud (${response.status}). Inténtalo de nuevo.`;
  }

  throw new SupplierCategoryRequestError(
    message,
    response.status,
  );
}

function normalizeSubcategory(
  subcategory: SupplierSubcategory,
): SupplierSubcategory {
  return {
    ...subcategory,
    supplier_id: Number(subcategory.supplier_id),
    supplier_category_id: subcategory.supplier_category_id ?? null,
    category_id: subcategory.category_id ?? null,
    subcategory_id:
      subcategory.subcategory_id ??
      null,
    is_active:
      subcategory.is_active !== false,
  };
}

function normalizeCategory(
  category: SupplierCategory,
): SupplierCategory {
  return {
    ...category,

    subcategory_id:
      category.subcategory_id ??
      null,

    is_active:
      category.is_active !== false,

    subcategories: Array.isArray(
      category.subcategories,
    )
      ? category.subcategories.map(
          normalizeSubcategory,
        )
      : [],
  };
}

function categoryFrom(
  payload: unknown,
): SupplierCategory {
  const root =
    recordOf(payload);

  const category =
    recordOf(root?.data) ??
    recordOf(
      root?.supplier_category,
    ) ??
    root;

  return normalizeCategory(
    category as unknown as SupplierCategory,
  );
}

function subcategoryFrom(
  payload: unknown,
): SupplierSubcategory {
  const root =
    recordOf(payload);

  const subcategory =
    recordOf(root?.data) ??
    recordOf(
      root?.supplier_subcategory,
    ) ??
    root;

  return normalizeSubcategory(
    subcategory as unknown as SupplierSubcategory,
  );
}

export const supplierCategoriesService =
  {
    /**
     * Categorías privadas del proveedor.
     *
     * includeInactive=false:
     * Product/Service forms.
     *
     * includeInactive=true:
     * pantalla Administrar categorías,
     * porque ahí necesitamos poder volver
     * a activar categorías desactivadas.
     */
    async list(
      supplierId: number,
      signal?: AbortSignal,
      includeInactive = false,
    ): Promise<SupplierCategory[]> {
      const query =
        new URLSearchParams({
          supplier_id:
            String(supplierId),
        });

      if (includeInactive) {
        query.set(
          "include_inactive",
          "true",
        );
      }

      const response =
        await request(
          `/api/supplier-categories?${query.toString()}`,
          {
            signal,
          },
        );

      const payload =
        await response.json();

      return listOf<SupplierCategory>(
        payload,
        ["supplier_categories"],
      ).map(normalizeCategory);
    },

    /**
     * Crear categoría privada.
     *
     * La categoría solamente se relaciona
     * con una Category GLOBAL.
     *
     * subcategory_id se manda null desde
     * la interfaz simplificada.
     */
    async create(
      input: CreateSupplierCategoryInput,
    ): Promise<SupplierCategory> {
      const response =
        await request(
          "/api/supplier-categories",
          {
            method: "POST",

            body: JSON.stringify(
              input,
            ),
          },
        );

      return categoryFrom(
        await response.json(),
      );
    },

    async update(
      id: number,
      input: UpdateSupplierCategoryInput,
    ): Promise<SupplierCategory> {
      const response =
        await request(
          `/api/supplier-categories/${id}`,
          {
            method: "PATCH",

            body: JSON.stringify(
              input,
            ),
          },
        );

      return categoryFrom(
        await response.json(),
      );
    },

    async delete(
      id: number,
    ): Promise<void> {
      await request(
        `/api/supplier-categories/${id}`,
        {
          method: "DELETE",
        },
      );
    },

    /**
     * Crear subcategoría privada.
     *
     * NO requiere relación con una
     * Subcategory global.
     */
    async createSubcategory(
      categoryId: number,
      input: SupplierSubcategoryInput,
    ): Promise<SupplierSubcategory> {
      const response =
        await request(
          `/api/supplier-categories/${categoryId}/subcategories`,
          {
            method: "POST",

            body: JSON.stringify(
              input,
            ),
          },
        );

      return subcategoryFrom(
        await response.json(),
      );
    },

    async listGlobalSupplierSubcategories(
      supplierId: number,
      categoryId: number,
      signal?: AbortSignal,
      includeInactive = false,
    ): Promise<SupplierSubcategory[]> {
      const query = new URLSearchParams({
        supplier_id: String(supplierId),
        category_id: String(categoryId),
      });
      if (includeInactive) query.set("include_inactive", "true");
      const response = await request(
        `/api/supplier-categories/subcategories?${query.toString()}`,
        { signal },
      );
      return listOf<SupplierSubcategory>(await response.json(), ["supplier_subcategories"])
        .map(normalizeSubcategory);
    },

    async createGlobalSubcategory(
      input: CreateGlobalSupplierSubcategoryInput,
    ): Promise<SupplierSubcategory> {
      const response = await request("/api/supplier-categories/subcategories", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return subcategoryFrom(await response.json());
    },

    async updateSubcategory(
      id: number,
      input: UpdateSupplierSubcategoryInput,
    ): Promise<SupplierSubcategory> {
      const response =
        await request(
          `/api/supplier-categories/subcategories/${id}`,
          {
            method: "PATCH",

            body: JSON.stringify(
              input,
            ),
          },
        );

      return subcategoryFrom(
        await response.json(),
      );
    },

    async deleteSubcategory(
      id: number,
    ): Promise<void> {
      await request(
        `/api/supplier-categories/subcategories/${id}`,
        {
          method: "DELETE",
        },
      );
    },

    /**
     * Catálogo GLOBAL Drooopy.
     */
    async listGlobalCategories(
      signal?: AbortSignal,
    ): Promise<DrooopyCategory[]> {
      const response =
        await request(
          "/api/categories/?skip=0&limit=100",
          {
            signal,
          },
        );

      const payload =
        await response.json();

      return listOf<DrooopyCategory>(
        payload,
        ["categories"],
      )
        .filter(
          (category) =>
            category.is_active !==
            false,
        )
        .map((category) => ({
          ...category,

          subcategories: [],
        }));
    },

    /**
     * Subcategorías GLOBALES.
     *
     * Estas solo se usan cuando
     * Product/Service selecciona
     * directamente una Category
     * de Drooopy.
     */
    async listGlobalSubcategories(
      categoryId: number,
      signal?: AbortSignal,
    ): Promise<
      DrooopySubcategory[]
    > {
      const response =
        await request(
          `/api/subcategories/?category_id=${encodeURIComponent(
            String(categoryId),
          )}&skip=0&limit=1000`,
          {
            signal,
          },
        );

      const payload =
        await response.json();

      return listOf<DrooopySubcategory>(
        payload,
        ["subcategories"],
      ).filter(
        (subcategory) =>
          subcategory.is_active !==
            false &&
          Number(
            subcategory.category_id,
          ) ===
            Number(categoryId),
      );
    },
  };
