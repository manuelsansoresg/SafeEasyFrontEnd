import { fetchWithAuth } from "@/lib/api";

export interface UserUpdatePayload {
  email: string;
  name: string;
  last_name?: string;
  second_last_name?: string;
  is_active: boolean;
  role: string;
  city_id?: number;
  state_id?: number;
  country_id?: number;
  password?: string;
}

export function splitUserFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    name: parts[0] ?? "",
    last_name: parts[1] ?? "",
    second_last_name: parts.length > 2 ? parts.slice(2).join(" ") : "",
  };
}

export function saveUser(userId: number, payload: Partial<UserUpdatePayload>) {
  return fetchWithAuth(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
