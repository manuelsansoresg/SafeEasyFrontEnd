import { fetchWithAuth } from "@/lib/api";
import type {
  AccountDeletionResponse,
  CancelByTokenResponse,
} from "@/types/account-deletion";

export async function requestAccountDeletion(): Promise<AccountDeletionResponse> {
  const res = await fetchWithAuth("/api/account/deletion-request", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { Accept: "application/json" },
  });

  const data: unknown = await res.json().catch(() => ({}));
  const rec = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;

  if (!res.ok) {
    // Backend devuelve: { detail: { code, message, obligations } } o { error_code, message, obligations }
    const detail = (rec.detail && typeof rec.detail === "object" ? rec.detail : {}) as Record<string, unknown>;
    const errorCode = (
      typeof rec.error_code === "string"
        ? rec.error_code
        : typeof detail.code === "string"
          ? detail.code
          : undefined
    ) as AccountDeletionResponse["error_code"] | undefined;
    const message = (
      typeof rec.message === "string"
        ? rec.message
        : typeof detail.message === "string"
          ? detail.message
          : typeof rec.detail === "string"
            ? rec.detail
            : undefined
    );
    const obligations = (
      Array.isArray(rec.obligations)
        ? rec.obligations
        : Array.isArray(detail.obligations)
          ? detail.obligations
          : undefined
    );

    return {
      status: "requested",
      error_code: errorCode,
      message,
      obligations: obligations as AccountDeletionResponse["obligations"],
    };
  }

  return {
    status: "requested",
    message: typeof rec.message === "string" ? rec.message : undefined,
    cancellation_token: typeof rec.cancellation_token === "string" ? rec.cancellation_token : undefined,
  };
}

export async function cancelDeletionByToken(
  token: string,
): Promise<CancelByTokenResponse> {
  const res = await fetch("/api/account/deletion/cancel-by-token", {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const data: unknown = await res.json().catch(() => ({}));
  const rec = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;

  if (!res.ok) {
    // Backend devuelve: { detail: { code, message } } o { error_code, message }
    const detail = (rec.detail && typeof rec.detail === "object" ? rec.detail : {}) as Record<string, unknown>;
    const errorCode = (
      typeof rec.error_code === "string"
        ? rec.error_code
        : typeof detail.code === "string"
          ? detail.code
          : undefined
    ) as CancelByTokenResponse["error_code"] | undefined;
    const message = (
      typeof rec.message === "string"
        ? rec.message
        : typeof detail.message === "string"
          ? detail.message
          : typeof rec.detail === "string"
            ? rec.detail
            : undefined
    );

    return {
      status: "cancelled",
      error_code: errorCode,
      message,
    };
  }

  return {
    status: "cancelled",
    message: typeof rec.message === "string" ? rec.message : undefined,
  };
}
