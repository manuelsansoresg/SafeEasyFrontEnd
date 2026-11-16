export type PropertyOperationType = "sale" | "rent";

const operationLabels = {
  sale: { listingLabel: "En venta", priceLabel: "Precio de venta", priceUnit: "MXN" },
  rent: { listingLabel: "En renta", priceLabel: "Renta mensual", priceUnit: "MXN/mes" },
};

export function getPropertyOperationLabels(operation?: PropertyOperationType | "" | null) {
  return operation === "sale" || operation === "rent" ? operationLabels[operation] : null;
}
