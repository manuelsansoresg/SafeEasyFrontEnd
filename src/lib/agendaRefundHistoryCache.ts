export function createAgendaRefundHistoryCache<T>({
  fetch,
  onLoaded,
  onError,
  onLoading,
  now = Date.now,
  maxAgeMs = 30000,
}: {
  fetch: (bookingId: number, signal?: AbortSignal) => Promise<T[]>;
  onLoaded: (bookingId: number, refunds: T[]) => void;
  onError: (bookingId: number, error: unknown) => void;
  onLoading: (bookingId: number, loading: boolean) => void;
  now?: () => number;
  maxAgeMs?: number;
}) {
  const loadedAt = new Map<number, number>();
  const inFlight = new Map<number, Promise<void>>();

  return {
    hasLoaded: (bookingId: number) => loadedAt.has(bookingId),
    load(bookingId: number, force = false, signal?: AbortSignal): Promise<void> {
      const pending = inFlight.get(bookingId);
      if (pending) return pending;
      const lastLoaded = loadedAt.get(bookingId);
      if (!force && lastLoaded !== undefined && now() - lastLoaded < maxAgeMs) return Promise.resolve();

      onLoading(bookingId, true);
      const request = fetch(bookingId, signal)
        .then((refunds) => {
          if (signal?.aborted) return;
          loadedAt.set(bookingId, now());
          onLoaded(bookingId, refunds);
        })
        .catch((error: unknown) => {
          if (!signal?.aborted) onError(bookingId, error);
        })
        .finally(() => {
          inFlight.delete(bookingId);
          onLoading(bookingId, false);
        });
      inFlight.set(bookingId, request);
      return request;
    },
  };
}
