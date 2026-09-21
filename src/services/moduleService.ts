import { fetchWithAuth } from "@/lib/api";
import type {
  ModuleAdminDetail,
  ModuleAdminList,
  ModuleCreatePayload,
  ModulePayment,
  ModulePurchaseResponse,
  ModuleUpdatePayload,
  SupplierModule,
  SupplierModuleAssignment,
  SupplierModuleGrantPayload,
  SupplierSummary,
} from "@/types/module";

const adminBase = "/api/admin/modules";
const supplierBase = "/api/modules";

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

    if (response.status === 402) {
      throw new Error(detail || "Este módulo requiere pago antes de activarse.");
    }

    if (response.status === 403) {
      throw new Error(
        detail || "No tienes permiso para realizar esta acción.",
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
  // =======================================================
  // PROVEEDOR
  // =======================================================

  async available(signal?: AbortSignal): Promise<SupplierModule[]> {
    const response = await request(`${supplierBase}/available`, { signal });
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Respuesta de módulos disponibles no válida.");
    }
    return data as SupplierModule[];
  },

  async mine(signal?: AbortSignal): Promise<SupplierModule[]> {
    const response = await request(`${supplierBase}/mine`, { signal });
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Respuesta de módulos no válida.");
    }
    return data as SupplierModule[];
  },

  async activate(moduleId: number): Promise<SupplierModule> {
    const response = await request(`${supplierBase}/${moduleId}/activate`, {
      method: "POST",
    });
    return response.json();
  },

  async setEnabled(moduleId: number, enabled: boolean): Promise<SupplierModule> {
    const response = await request(`${supplierBase}/${moduleId}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    return response.json();
  },

  async purchase(moduleId: number): Promise<ModulePurchaseResponse> {
    const response = await request(`${supplierBase}/${moduleId}/purchase`, {
      method: "POST",
    });
    return response.json();
  },

  async payments(signal?: AbortSignal): Promise<ModulePayment[]> {
    const response = await request(`${supplierBase}/payments`, { signal });
    return listItems<ModulePayment>(await response.json(), "payments");
  },

  async paymentStatus(paymentId: number, signal?: AbortSignal): Promise<ModulePayment> {
    const response = await request(`${supplierBase}/payments/${paymentId}/status`, {
      signal,
    });
    return response.json();
  },

  async refreshPayment(mpPaymentId: string): Promise<ModulePayment> {
    const query = new URLSearchParams({ mp_payment_id: mpPaymentId });
    const response = await request(`${supplierBase}/payments/refresh?${query.toString()}`, {
      method: "POST",
    });
    return response.json();
  },

  // =======================================================
  // ADMINISTRADOR
  // =======================================================

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
    payload: ModuleUpdatePayload,
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

  async setPlans(
    id: number,
    planIds: number[],
  ): Promise<ModuleAdminDetail> {
    const response = await request(`${adminBase}/${id}/plans`, {
      method: "PUT",
      body: JSON.stringify({ plan_ids: planIds }),
    });
    return response.json();
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
