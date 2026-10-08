const abortedMessages = new Set([
  "fetch is aborted",
  "the operation was aborted",
  "this operation was aborted",
  "the user aborted a request",
]);

export function isExpectedAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" ||
    abortedMessages.has(error.message.trim().toLowerCase());
}

export function isHttpConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "status" in error && error.status === 409;
}
