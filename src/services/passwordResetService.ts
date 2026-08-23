export interface PasswordResetRequestResponse {
  msg: string;
}

export interface PasswordResetConfirmResponse {
  msg: string;
}

export function extractApiError(status: number, detail: unknown): string {
  if (status === 429) {
    return "rate_limit";
  }

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0] as Record<string, unknown> | undefined;
    if (first?.msg) return String(first.msg);
  }

  if (typeof detail === "object" && detail !== null) {
    const d = detail as Record<string, unknown>;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.message === "string") return d.message;
    if (typeof d.msg === "string") return d.msg;
  }

  return "";
}

export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResponse> {
  try {
    const response = await fetch("/api/login/password-reset/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let detail: unknown = text;
      try {
        detail = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      const message = extractApiError(response.status, detail);
      if (message === "rate_limit") {
        throw new Error("rate_limit");
      }
      throw new Error(message || `Error ${response.status}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("network_error");
  }
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<PasswordResetConfirmResponse> {
  try {
    const response = await fetch("/api/login/password-reset/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let detail: unknown = text;
      try {
        detail = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      const message = extractApiError(response.status, detail);
      if (message === "rate_limit") {
        throw new Error("rate_limit");
      }
      throw new Error(message || `Error ${response.status}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("network_error");
  }
}
