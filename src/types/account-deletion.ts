export type AccountDeletionErrorCode =
  | "ACCOUNT_HAS_ACTIVE_OBLIGATIONS"
  | "ACCOUNT_DELETION_ALREADY_REQUESTED"
  | "ACCOUNT_PENDING_DELETION"
  | "ACCOUNT_DELETION_NOT_FOUND"
  | "ACCOUNT_DELETION_CANNOT_CANCEL"
  | "INVALID_OR_EXPIRED_DELETION_TOKEN";

export interface DeletionObligation {
  type: string;
  description: string;
  [key: string]: unknown;
}

export interface AccountDeletionRequest {
  password: string;
}

export interface AccountDeletionResponse {
  status: "requested" | "already_requested" | "pending_deletion";
  message?: string;
  error_code?: AccountDeletionErrorCode;
  obligations?: DeletionObligation[] | string;
  cancellation_token?: string;
}

export interface CancelByTokenRequest {
  token: string;
}

export interface CancelByTokenResponse {
  status: "cancelled";
  message?: string;
  error_code?: AccountDeletionErrorCode;
}

export interface LoginPendingDeletionData {
  error_code: "ACCOUNT_PENDING_DELETION";
  message: string;
  cancellation_token?: string;
}
