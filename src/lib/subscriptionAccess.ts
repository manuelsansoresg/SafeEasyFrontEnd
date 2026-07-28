type RecordLike = Record<string, unknown>;

const asRecord = (value: unknown): RecordLike | null => {
  if (!value || typeof value !== "object") return null;
  return value as RecordLike;
};

const readStatus = (value: unknown) => {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
};

const readDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const readBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "si", "sí"].includes(value.trim().toLowerCase());
};

export const isSubscriptionActive = (subscription: unknown) => {
  const record = asRecord(subscription);
  if (!record) return false;

  const status = readStatus(record.status);
  if (status && !["active", "paid", "approved"].includes(status)) return false;

  const endDate = readDate(record.end_date ?? record.endDate ?? record.expires_at ?? record.expiresAt);
  if (endDate && endDate.getTime() <= Date.now()) return false;

  return status === "active" || status === "paid" || status === "approved" || Boolean(endDate);
};

export const isDirectorySubscription = (subscription: unknown) => {
  const record = asRecord(subscription);
  if (!record || !isSubscriptionActive(record)) return false;

  const plan = asRecord(record.plan);
  return readBoolean(
    record.is_directory ??
      record.isDirectory ??
      record.plan_is_directory ??
      record.planIsDirectory ??
      plan?.is_directory ??
      plan?.isDirectory,
  );
};

export const supplierHasDirectorySubscription = (supplier: unknown) => {
  const record = asRecord(supplier);
  if (!record) return false;

  if (
    readBoolean(
      record.is_directory ??
        record.isDirectory ??
        record.subscription_is_directory ??
        record.subscriptionIsDirectory ??
        record.plan_is_directory ??
        record.planIsDirectory,
    )
  ) {
    return true;
  }

  const candidates = [
    record.subscription,
    record.active_subscription,
    record.supplier_subscription,
    record.supplierSubscription,
  ];
  return candidates.some(isDirectorySubscription);
};

export const supplierHasActiveSubscription = (supplier: unknown) => {
  const record = asRecord(supplier);
  if (!record) return false;

  // 1) Si el backend expone el flag has_active_subscription, úsalo como fuente de verdad.
  if (
    readBoolean(
      record.has_active_subscription ??
        record.hasActiveSubscription ??
        record.subscription_active ??
        record.subscriptionActive,
    )
  ) {
    return true;
  }

  // 2) Si no, busca una suscripción embebida y valida con isSubscriptionActive.
  const candidates = [
    record.subscription,
    record.active_subscription,
    record.supplier_subscription,
    record.supplierSubscription,
  ];
  return candidates.some(isSubscriptionActive);
};

export const productHasActiveSupplierSubscription = (product: unknown) => {
  const record = asRecord(product);
  if (!record) return true;

  const supplier = asRecord(record.supplier);
  const candidates = [
    record.subscription,
    record.supplier_subscription,
    record.supplierSubscription,
    supplier?.subscription,
    supplier?.supplier_subscription,
    supplier?.supplierSubscription,
  ];

  const subscription = candidates.find((candidate) => asRecord(candidate));
  if (subscription) return isSubscriptionActive(subscription);

  const status = readStatus(
    record.subscription_status ??
      record.supplier_subscription_status ??
      record.supplierSubscriptionStatus ??
      supplier?.subscription_status ??
      supplier?.supplier_subscription_status ??
      supplier?.supplierSubscriptionStatus,
  );

  if (status) return ["active", "paid", "approved"].includes(status);

  const endDate = readDate(
    record.subscription_end_date ??
      record.supplier_subscription_end_date ??
      record.subscriptionEndDate ??
      record.supplierSubscriptionEndDate ??
      supplier?.subscription_end_date ??
      supplier?.supplier_subscription_end_date ??
      supplier?.subscriptionEndDate ??
      supplier?.supplierSubscriptionEndDate,
  );

  if (endDate) return endDate.getTime() > Date.now();

  return true;
};

export const filterProductsByActiveSupplierSubscription = <T>(products: T[]) =>
  products.filter(productHasActiveSupplierSubscription);
