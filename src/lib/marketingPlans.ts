import type { Plan } from "@/types/subscriptions";

export type NewLandingKind = "menu" | "products" | "agenda";

export function selectMarketingPlan(plans: Plan[], kind: NewLandingKind): Plan | null {
  const active = plans.filter((plan) => plan.is_active && plan.is_listed !== false);
  if (kind === "menu") return active.find((plan) => plan.is_directory === true) ?? null;

  if (kind === "agenda") {
    return active.filter((plan) => plan.module_codes?.includes("agenda"))
      .sort((a, b) => (a.display_order ?? Infinity) - (b.display_order ?? Infinity) || a.price - b.price || a.id - b.id)[0] ?? null;
  }

  // The backend exposes no stable plan code. Product capacity distinguishes
  // the entry tier from Professional without relying on translated titles.
  const productPlans = active.filter((plan) =>
    plan.is_directory !== true && typeof plan.max_active_products === "number" && plan.max_active_products > 0,
  );
  productPlans.sort((a, b) => (a.max_active_products ?? Infinity) - (b.max_active_products ?? Infinity));
  return productPlans[0] ?? null;
}

export function hasProfessionalOption(plans: Plan[], selected: Plan | null): boolean {
  if (!selected) return false;
  return plans.some((plan) => plan.is_active && plan.is_listed !== false && plan.is_directory !== true &&
    plan.id !== selected.id && typeof plan.max_active_products === "number" &&
    plan.max_active_products > (selected.max_active_products ?? 0));
}

export function plansFromPayload(payload: unknown): Plan[] {
  if (Array.isArray(payload)) return payload as Plan[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const items = record.items ?? record.results ?? record.data ?? record.plans;
  return Array.isArray(items) ? items as Plan[] : [];
}
