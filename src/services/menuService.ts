import { fetchWithAuth } from "@/lib/api";
import type {
  Menu,
  MenuCatalogItem,
  MenuCatalogItemCreatePayload,
  MenuCatalogItemUpdatePayload,
  MenuCreatePayload,
  MenuItem,
  MenuItemPayload,
  MenuItemVariant,
  MenuItemVariantPayload,
  MenuSection,
  MenuSectionItemBulkAttachPayload,
  MenuSectionPayload,
  MenuUpdatePayload,
} from "@/types/menu";

const base = "/api/menus";

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map(extractError).filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractError(
      record.detail ?? record.message ?? record.msg ?? record.error,
    );
  }
  return undefined;
}

async function request(
  url: string,
  options?: Parameters<typeof fetchWithAuth>[1],
): Promise<Response> {
  const response = await fetchWithAuth(url, {
    cache: "no-store",
    ...options,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = extractError(body);

    if (response.status === 401) {
      throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    if (response.status === 403) {
      throw new Error(detail || "No tienes acceso al módulo Menú.");
    }
    if (response.status === 404) {
      throw new Error(detail || "El recurso solicitado no existe.");
    }
    if (response.status === 409) {
      throw new Error(
        detail || "No se pudo completar la operación por un conflicto.",
      );
    }
    if (response.status === 422) {
      throw new Error(
        detail || "Revisa los datos capturados e inténtalo nuevamente.",
      );
    }

    throw new Error(
      detail || `No se pudo completar la solicitud (${response.status}).`,
    );
  }

  return response;
}

export const menuService = {
  async publicList(slug: string, signal?: AbortSignal): Promise<Menu[]> {
    const response = await fetch(
      `/api/public/menus/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        signal,
      },
    );

    if (response.status === 404) return [];

    if (!response.ok) {
      throw new Error(`No se pudo cargar el menú público (${response.status}).`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];

    const byDisplayOrderAndId = <T extends { display_order: number; id: number }>(
      first: T,
      second: T,
    ) => first.display_order - second.display_order || first.id - second.id;

    return (data as Menu[])
      .filter((menu) => menu.is_active)
      .map((menu) => ({
        ...menu,
        sections: (Array.isArray(menu.sections) ? menu.sections : [])
          .filter((section) => section.is_active)
          .map((section) => ({
            ...section,
            items: (Array.isArray(section.items) ? section.items : [])
              .filter((item) => item.is_active)
              .sort(byDisplayOrderAndId),
          }))
          .filter((section) => section.items.length > 0)
          .sort(byDisplayOrderAndId),
      }))
      .sort(byDisplayOrderAndId);
  },

  async list(signal?: AbortSignal): Promise<Menu[]> {
    const response = await request(base, { signal });
    return response.json();
  },

  async detail(id: number, signal?: AbortSignal): Promise<Menu> {
    const response = await request(`${base}/${id}`, { signal });
    return response.json();
  },

  async create(payload: MenuCreatePayload): Promise<Menu> {
    const response = await request(base, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async update(id: number, payload: MenuUpdatePayload): Promise<Menu> {
    const response = await request(`${base}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateSetupProgress(id: number, step: number): Promise<Menu> {
    const response = await request(`${base}/${id}/setup-progress`, {
      method: "PATCH",
      body: JSON.stringify({ step }),
    });
    return response.json();
  },

  async publish(id: number): Promise<Menu> {
    const response = await request(`${base}/${id}/publish`, {
      method: "POST",
    });
    return response.json();
  },

  async remove(id: number): Promise<void> {
    await request(`${base}/${id}`, { method: "DELETE" });
  },

  async uploadImage(id: number, file: File): Promise<Menu> {
    const formData = new FormData();
    formData.append("image", file);
    const response = await request(`${base}/${id}/image`, {
      method: "PUT",
      body: formData,
    });
    return response.json();
  },

  async deleteImage(id: number): Promise<Menu> {
    const response = await request(`${base}/${id}/image`, {
      method: "DELETE",
    });
    return response.json();
  },

  async createSection(
    menuId: number,
    payload: MenuSectionPayload,
  ): Promise<MenuSection> {
    const response = await request(`${base}/${menuId}/sections`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateSection(
    menuId: number,
    sectionId: number,
    payload: Partial<MenuSectionPayload>,
  ): Promise<MenuSection> {
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async removeSection(menuId: number, sectionId: number): Promise<void> {
    await request(`${base}/${menuId}/sections/${sectionId}`, {
      method: "DELETE",
    });
  },

  async listCatalog(
    options?: {
      activeOnly?: boolean;
      q?: string;
      signal?: AbortSignal;
    },
  ): Promise<MenuCatalogItem[]> {
    const params = new URLSearchParams();
    if (options?.activeOnly) params.set("active_only", "true");
    if (options?.q?.trim()) params.set("q", options.q.trim());
    const query = params.toString();

    const response = await request(
      `${base}/catalog/items${query ? `?${query}` : ""}`,
      { signal: options?.signal },
    );
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as MenuCatalogItem[]) : [];
  },

  async createCatalogItem(
    payload: MenuCatalogItemCreatePayload,
  ): Promise<MenuCatalogItem> {
    const response = await request(`${base}/catalog/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateCatalogItem(
    itemId: number,
    payload: MenuCatalogItemUpdatePayload,
  ): Promise<MenuCatalogItem> {
    const response = await request(`${base}/catalog/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async removeCatalogItem(itemId: number): Promise<void> {
    await request(`${base}/catalog/items/${itemId}`, {
      method: "DELETE",
    });
  },

  async uploadCatalogItemImage(
    itemId: number,
    file: File,
  ): Promise<MenuCatalogItem> {
    const formData = new FormData();
    formData.append("image", file);
    const response = await request(`${base}/catalog/items/${itemId}/image`, {
      method: "PUT",
      body: formData,
    });
    return response.json();
  },

  async deleteCatalogItemImage(itemId: number): Promise<MenuCatalogItem> {
    const response = await request(`${base}/catalog/items/${itemId}/image`, {
      method: "DELETE",
    });
    return response.json();
  },

  async listVariants(itemId: number, signal?: AbortSignal): Promise<MenuItemVariant[]> {
    const response = await request(`${base}/catalog/items/${itemId}/variants`, { signal });
    const data: unknown = await response.json();
    return Array.isArray(data) ? data as MenuItemVariant[] : [];
  },

  async createVariant(itemId: number, payload: MenuItemVariantPayload): Promise<MenuItemVariant> {
    const response = await request(`${base}/catalog/items/${itemId}/variants`, {
      method: "POST", body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateVariant(itemId: number, variantId: number, payload: Partial<MenuItemVariantPayload>): Promise<MenuItemVariant> {
    const response = await request(`${base}/catalog/items/${itemId}/variants/${variantId}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
    return response.json();
  },

  async removeVariant(itemId: number, variantId: number): Promise<void> {
    await request(`${base}/catalog/items/${itemId}/variants/${variantId}`, { method: "DELETE" });
  },

  async saveVariants(itemId: number, variants: Array<MenuItemVariantPayload & { id?: number }>, originalIds: number[]): Promise<void> {
    const retained = new Set(variants.map((variant) => variant.id).filter((id): id is number => id != null));
    for (const variant of variants) {
      const { id, ...payload } = variant;
      if (id != null) await this.updateVariant(itemId, id, payload);
      else await this.createVariant(itemId, payload);
    }
    for (const id of originalIds) {
      if (!retained.has(id)) await this.removeVariant(itemId, id);
    }
  },

  async createItem(
    menuId: number,
    sectionId: number,
    payload: MenuItemPayload,
  ): Promise<MenuItem> {
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}/items`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async attachItems(
    menuId: number,
    sectionId: number,
    payload: MenuSectionItemBulkAttachPayload,
  ): Promise<MenuItem[]> {
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}/items/attach-many`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async updateItem(
    menuId: number,
    sectionId: number,
    itemId: number,
    payload: Partial<MenuItemPayload>,
  ): Promise<MenuItem> {
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}/items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async removeItem(
    menuId: number,
    sectionId: number,
    itemId: number,
  ): Promise<void> {
    await request(
      `${base}/${menuId}/sections/${sectionId}/items/${itemId}`,
      { method: "DELETE" },
    );
  },

  async uploadItemImage(
    menuId: number,
    sectionId: number,
    itemId: number,
    file: File,
  ): Promise<MenuItem> {
    const formData = new FormData();
    formData.append("image", file);
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}/items/${itemId}/image`,
      {
        method: "PUT",
        body: formData,
      },
    );
    return response.json();
  },

  async deleteItemImage(
    menuId: number,
    sectionId: number,
    itemId: number,
  ): Promise<MenuItem> {
    const response = await request(
      `${base}/${menuId}/sections/${sectionId}/items/${itemId}/image`,
      { method: "DELETE" },
    );
    return response.json();
  },
};
