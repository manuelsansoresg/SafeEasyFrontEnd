import { fetchWithAuth } from "@/lib/api";
import type {
  Menu,
  MenuCreatePayload,
  MenuItem,
  MenuItemPayload,
  MenuSection,
  MenuSectionPayload,
  MenuUpdatePayload,
  ModuleAccessResponse,
} from "@/types/menu";

const base = "/api/backend/menus";
const moduleBase = "/api/backend/modules";

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
      throw new Error(
        detail || "No tienes acceso al módulo Menú.",
      );
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
  async access(signal?: AbortSignal): Promise<ModuleAccessResponse> {
    const response = await request(`${moduleBase}/menu/access`, { signal });
    return response.json();
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
