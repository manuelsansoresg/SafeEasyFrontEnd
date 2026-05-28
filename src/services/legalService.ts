import { fetchWithAuth } from "@/lib/api";

export type LegalSectionType = "terms_and_conditions" | "privacy_policy";

export interface LegalDocument {
  id: number;
  section_type: LegalSectionType;
  title: string;
  subtitle: string;
  content: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export type LegalDocumentPayload = {
  title: string;
  subtitle: string;
  content: string;
  is_active?: boolean;
};

const getLatestActiveDocument = (documents: LegalDocument[]) => {
  return documents
    .filter((document) => document.is_active)
    .sort((a, b) => b.version - a.version || b.id - a.id)[0] ?? null;
};

export const legalService = {
  list: async (sectionType: LegalSectionType): Promise<LegalDocument[]> => {
    const q = new URLSearchParams({
      section_type: sectionType,
      skip: "0",
      limit: "20",
    });
    const res = await fetchWithAuth(`/api/admin/legal?${q.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getCurrent: async (sectionType: LegalSectionType): Promise<LegalDocument | null> => {
    const documents = await legalService.list(sectionType);
    return getLatestActiveDocument(documents);
  },

  create: async (
    sectionType: LegalSectionType,
    payload: LegalDocumentPayload
  ): Promise<LegalDocument | null> => {
    const res = await fetchWithAuth("/api/admin/legal", {
      method: "POST",
      body: JSON.stringify({
        section_type: sectionType,
        title: payload.title,
        subtitle: payload.subtitle,
        content: payload.content,
        is_active: payload.is_active ?? true,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  },

  update: async (
    id: number,
    payload: LegalDocumentPayload
  ): Promise<LegalDocument | null> => {
    const res = await fetchWithAuth(`/api/admin/legal/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json();
  },

  delete: async (id: number): Promise<boolean> => {
    const res = await fetchWithAuth(`/api/admin/legal/${id}`, { method: "DELETE" });
    return res.ok;
  },
};
