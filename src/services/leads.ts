import { fetchWithAuth } from "@/lib/api";

function adminLeadsPath(id?: number) {
  const path = `/api/admin/leads${id === undefined ? "" : `/${id}`}`;
  return process.env.NODE_ENV === "production" ? path : `${path}/`;
}

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadInterest = "DIRECTORY" | "MENU" | "PRODUCTS" | "AGENDA";
export type LeadPlan = "DIRECTORY" | "STANDARD" | "PROFESSIONAL";

export interface Lead {
  id: number;
  name: string;
  phone: string;
  business_name: string | null;
  interest: LeadInterest;
  recommended_plan: LeadPlan;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  landing_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  referrer: string | null;
  notes: string | null;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  skip: number;
  limit: number;
}

export type LeadUpdate = Partial<Pick<Lead, "name" | "phone" | "business_name" | "status" | "recommended_plan" | "notes">>;

export interface LeadListParams {
  search?: string;
  status?: LeadStatus;
  interest?: LeadInterest;
  skip: number;
  limit: number;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "No se pudo completar la solicitud.";
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body) {
        const detail = body.detail;
        if (typeof detail === "string") message = detail;
      }
    } catch {
      // The fallback message covers non-JSON errors.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const leadsService = {
  list: ({ search, status, interest, skip, limit }: LeadListParams) => {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (interest) params.set("interest", interest);
    return fetchWithAuth(`${adminLeadsPath()}?${params.toString()}`, { cache: "no-store" })
      .then(readResponse<LeadListResponse>);
  },
  get: (id: number) => fetchWithAuth(adminLeadsPath(id), { cache: "no-store" })
    .then(readResponse<Lead>),
  update: (id: number, changes: LeadUpdate) => fetchWithAuth(adminLeadsPath(id), {
    method: "PATCH",
    body: JSON.stringify(changes),
  }).then(readResponse<Lead>),
};
