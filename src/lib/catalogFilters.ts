import type {
  DrooopyCategory,
  DrooopySubcategory,
  SupplierCategory,
  SupplierSubcategory,
} from "@/types/supplierCategories";

export type CatalogFilterSource = "global" | "supplier";

export type CatalogFilterTarget = {
  id: number;
  slug: string;
  source: CatalogFilterSource;
};

export type CatalogFilterRoute = {
  category: CatalogFilterTarget;
  subcategory?: CatalogFilterTarget;
};

export type CatalogFilterOption = {
  key: string;
  name: string;
  routes: CatalogFilterRoute[];
  subcategories: CatalogFilterOption[];
};

export type CatalogClassifiedItem = {
  category?: DrooopyCategory | null;
  subcategory?: DrooopySubcategory | null;
  supplier_category?: SupplierCategory | null;
  supplier_subcategory?: SupplierSubcategory | null;
};

export type CatalogRequestFilters = {
  category?: string;
  subcategory?: string;
  supplierCategory?: string;
  supplierSubcategory?: string;
};

const normalizeLabel = (value: string) =>
  value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const fallbackSlug = (value: string) =>
  normalizeLabel(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const targetKey = (target: CatalogFilterTarget) =>
  `${target.source}:${target.id}:${target.slug}`;

const routeKey = (route: CatalogFilterRoute) =>
  `${targetKey(route.category)}>${route.subcategory ? targetKey(route.subcategory) : "all"}`;

function targetFrom(
  value: { id: number; name: string; slug?: string; is_active?: boolean } | null | undefined,
  source: CatalogFilterSource,
): CatalogFilterTarget | null {
  if (!value || value.is_active === false) return null;
  const slug = value.slug?.trim() || fallbackSlug(value.name);
  return slug ? { id: Number(value.id), slug, source } : null;
}

function effectiveClassification(item: CatalogClassifiedItem) {
  const hasSupplierCategory = Boolean(item.supplier_category);
  const supplierCategory = targetFrom(item.supplier_category, "supplier");
  const globalCategory = targetFrom(item.category, "global");
  const category = hasSupplierCategory ? supplierCategory : globalCategory;
  const categoryName = hasSupplierCategory
    ? supplierCategory && item.supplier_category?.name
    : globalCategory && item.category?.name;

  const hasSupplierSubcategory = Boolean(item.supplier_subcategory);
  const supplierSubcategory = targetFrom(item.supplier_subcategory, "supplier");
  const globalSubcategory = targetFrom(item.subcategory, "global");
  const subcategory = hasSupplierSubcategory
    ? supplierSubcategory
    : globalSubcategory;
  const subcategoryName = hasSupplierSubcategory
    ? supplierSubcategory && item.supplier_subcategory?.name
    : globalSubcategory && item.subcategory?.name;

  return { category, categoryName, subcategory, subcategoryName };
}

export function buildCatalogFilterOptions(
  items: CatalogClassifiedItem[],
): CatalogFilterOption[] {
  const categories = new Map<string, CatalogFilterOption>();

  for (const item of items) {
    const { category, categoryName, subcategory, subcategoryName } =
      effectiveClassification(item);
    if (!category || !categoryName?.trim()) continue;

    const categoryKey = normalizeLabel(categoryName);
    const option = categories.get(categoryKey) ?? {
      key: categoryKey,
      name: categoryName.trim(),
      routes: [],
      subcategories: [],
    };
    const route: CatalogFilterRoute = {
      category,
      ...(subcategory ? { subcategory } : {}),
    };
    if (!option.routes.some((current) => routeKey(current) === routeKey(route))) {
      option.routes.push(route);
    }

    if (subcategory && subcategoryName?.trim()) {
      const subcategoryKey = normalizeLabel(subcategoryName);
      let subcategoryOption = option.subcategories.find(
        (current) => current.key === subcategoryKey,
      );
      if (!subcategoryOption) {
        subcategoryOption = {
          key: subcategoryKey,
          name: subcategoryName.trim(),
          routes: [],
          subcategories: [],
        };
        option.subcategories.push(subcategoryOption);
      }
      if (
        !subcategoryOption.routes.some(
          (current) => routeKey(current) === routeKey(route),
        )
      ) {
        subcategoryOption.routes.push(route);
      }
    }

    categories.set(categoryKey, option);
  }

  return [...categories.values()]
    .map((category) => ({
      ...category,
      subcategories: category.subcategories.toSorted((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name, "es"));
}

export function catalogRequestVariants(
  category: CatalogFilterOption | null,
  subcategory: CatalogFilterOption | null,
): CatalogRequestFilters[] {
  if (!category) return [{}];

  const routes: CatalogFilterRoute[] = subcategory
    ? subcategory.routes.filter((route) => route.subcategory)
    : category.routes.map((route) => ({ category: route.category }));
  const variants = new Map<string, CatalogRequestFilters>();

  for (const route of routes) {
    const filters: CatalogRequestFilters = {};
    if (route.category.source === "supplier") {
      filters.supplierCategory = route.category.slug;
    } else {
      filters.category = route.category.slug;
    }
    if (route.subcategory?.source === "supplier") {
      filters.supplierSubcategory = route.subcategory.slug;
    } else if (route.subcategory) {
      filters.subcategory = route.subcategory.slug;
    }
    variants.set(JSON.stringify(filters), filters);
  }

  return [...variants.values()];
}

export function matchesCatalogFilters(
  item: CatalogClassifiedItem,
  category: CatalogFilterOption | null,
  subcategory: CatalogFilterOption | null,
) {
  if (!category) return true;
  const classification = effectiveClassification(item);
  if (!classification.category) return false;

  const routes = subcategory ? subcategory.routes : category.routes;
  return routes.some(
    (route) =>
      targetKey(route.category) === targetKey(classification.category!) &&
      (!subcategory ||
        (route.subcategory &&
          classification.subcategory &&
          targetKey(route.subcategory) === targetKey(classification.subcategory))),
  );
}
