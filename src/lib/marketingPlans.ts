import type { Plan } from "@/types/subscriptions";

export type NewLandingKind = "menu" | "products" | "agenda";

function planOffersAgenda(plan: Plan): boolean {
  if (Array.isArray(plan.module_codes)) return plan.module_codes.includes("agenda");

  // Compatibility with older public responses without module_codes:
  // only an explicit Agenda line can establish that the module is included.
  const lines = [...(plan.features ?? []), ...(plan.description ?? "").split(/\r?\n/)];
  return lines.some((line) => /^m[oó]dulo\s+(?:de\s+)?agenda\b/i.test(line.trim()));
}

/** Eligible Agenda offers, using the same visibility rules as the landing. */
export function getAgendaMarketingPlans(plans: Plan[], includeUnlisted = false): Plan[] {
  return plans.filter((plan) => plan.is_active &&
    (includeUnlisted || (plan.is_listed === true && plan.is_demo !== true)) && planOffersAgenda(plan))
    .sort((a, b) => a.price - b.price || (a.display_order ?? Infinity) - (b.display_order ?? Infinity) || a.id - b.id);
}

export function selectMarketingPlan(plans: Plan[], kind: NewLandingKind, includeUnlisted = false): Plan | null {
  const active = plans.filter((plan) => plan.is_active && (includeUnlisted || plan.is_listed !== false));
  if (kind === "menu") return active.find((plan) => plan.is_directory === true) ?? null;

  if (kind === "agenda") {
    return getAgendaMarketingPlans(plans, includeUnlisted)[0] ?? null;
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
