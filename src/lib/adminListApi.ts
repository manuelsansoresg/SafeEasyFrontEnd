import { fetchWithAuth, type FetchOptions } from "@/lib/api";

const RETRY_WITHOUT_DELETED_STATUSES = new Set([400, 404, 422, 500, 502, 503, 504]);

export async function fetchAdminList(
  path: string,
  params: URLSearchParams,
  options: FetchOptions = {},
) {
  const requestedParams = new URLSearchParams(params);
  let response = await fetchWithAuth(
    `${path}?${requestedParams.toString()}`,
    options,
  );

  if (
    requestedParams.has("include_deleted") &&
    RETRY_WITHOUT_DELETED_STATUSES.has(response.status)
  ) {
    requestedParams.delete("include_deleted");
    response = await fetchWithAuth(
      `${path}?${requestedParams.toString()}`,
      options,
    );
  }

  return response;
}
