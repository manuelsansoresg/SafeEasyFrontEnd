import { getPropertyOperationLabels, type PropertyOperationType } from "@/lib/propertyOperation";
import { cn } from "@/lib/utils";

type PropertyOperationBadgeProps = {
  operation?: PropertyOperationType | null;
  className?: string;
};

export function PropertyOperationBadge({ operation, className }: PropertyOperationBadgeProps) {
  const labels = getPropertyOperationLabels(operation);
  if (!labels) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        operation === "rent"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
    >
      {labels.listingLabel}
    </span>
  );
}
