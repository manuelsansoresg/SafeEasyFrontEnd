import { fetchWithAuth } from "@/lib/api";
import type {
  ModuleAdminDetail,
  ModuleAdminList,
  ModuleCreatePayload,
  ModuleUpdatePayload,
  SupplierModuleAssignment,
  SupplierModuleGrantPayload,
  SupplierSummary,
} from "@/types/module";

const adminBase = "/api/admin/modules";

function errorMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts = value.map(errorMessage).filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (
      typeof record.message === "string" &&
      typeof record.code === "string"
    ) {
      return record.message;
    }

    return errorMessage(
      record.detail ??
        record.message ??
        record.msg ??
        record.error,
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
    const detail = errorMessage(body);

    if (response.status === 401) {
      throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    }

    if (response.status === 403) {
      throw new Error(
        detail || "No tienes permiso para administrar módulos.",
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
      detail ||
        `No se pudo completar la solicitud (${response.status}).`,
    );
  }

  return response;
}

function listItems<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items =
      record.items ??
      record.results ??
      record.data ??
      record[key];

    if (Array.isArray(items)) return items as T[];
  }

  return [];
}

export const moduleService = {
  async list(
    params: {
      search?: string;
      is_active?: boolean;
      skip?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<ModuleAdminList[]> {
    const query = new URLSearchParams({
      skip: String(params.skip ?? 0),
      limit: String(params.limit ?? 100),
    });

    if (params.search?.trim()) {
      query.set("search", params.search.trim());
    }

    if (params.is_active !== undefined) {
      query.set("is_active", String(params.is_active));
    }

    const response = await request(
      `${adminBase}?${query.toString()}`,
      { signal },
    );

    return listItems<ModuleAdminList>(
      await response.json(),
      "modules",
    );
  },

  async detail(
    id: number,
    signal?: AbortSignal,
  ): Promise<ModuleAdminDetail> {
    const response = await request(
      `${adminBase}/${id}`,
      { signal },
    );
    return response.json();
  },

  async create(
    payload: ModuleCreatePayload,
  ): Promise<ModuleAdminDetail> {
    const response = await request(adminBase, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async update(
    id: number,
    payload: Partial<ModuleUpdatePayload>,
  ): Promise<ModuleAdminDetail> {
    const response = await request(
      `${adminBase}/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async deactivate(id: number): Promise<void> {
    await request(`${adminBase}/${id}`, {
      method: "DELETE",
    });
  },

  async setAllowedSuppliers(
    id: number,
    supplierIds: number[],
  ): Promise<ModuleAdminDetail> {
    const response = await request(
      `${adminBase}/${id}/allowed-suppliers`,
      {
        method: "PUT",
        body: JSON.stringify({
          supplier_ids: supplierIds,
        }),
      },
    );
    return response.json();
  },

  async listAssignments(
    id: number,
    signal?: AbortSignal,
  ): Promise<SupplierModuleAssignment[]> {
    const response = await request(
      `${adminBase}/${id}/suppliers`,
      { signal },
    );
    return listItems<SupplierModuleAssignment>(
      await response.json(),
      "assignments",
    );
  },

  async grantSupplier(
    moduleId: number,
    supplierId: number,
    payload: SupplierModuleGrantPayload,
  ): Promise<SupplierModuleAssignment> {
    const response = await request(
      `${adminBase}/${moduleId}/suppliers/${supplierId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },

  async suppliers(
    search = "",
    signal?: AbortSignal,
  ): Promise<SupplierSummary[]> {
    const query = new URLSearchParams({
      skip: "0",
      limit: "1000",
    });

    if (search.trim()) {
      query.set("search", search.trim());
    }

    const response = await request(
      `/api/suppliers/?${query.toString()}`,
      { signal },
    );

    return listItems<SupplierSummary>(
      await response.json(),
      "suppliers",
    );
  },
};
