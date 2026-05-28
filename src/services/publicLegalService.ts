import type { LegalDocument, LegalSectionType } from "@/services/legalService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";

export async function getActiveLegalDocument(sectionType: LegalSectionType): Promise<LegalDocument | null> {
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/legal/${sectionType}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
