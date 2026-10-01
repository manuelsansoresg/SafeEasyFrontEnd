"use client";

import type { CatalogFilterOption } from "@/lib/catalogFilters";

type SupplierCatalogFiltersProps = {
  categories: CatalogFilterOption[];
  selectedCategory: CatalogFilterOption | null;
  selectedSubcategory: CatalogFilterOption | null;
  onCategoryChange: (category: CatalogFilterOption | null) => void;
  onSubcategoryChange: (subcategory: CatalogFilterOption | null) => void;
  label: string;
};

const chipClass = (selected: boolean) =>
  `shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--supplier-primary)_22%,transparent)] active:scale-[0.98] ${
    selected
      ? "border-[var(--supplier-chip-outline)] bg-[var(--supplier-primary)] text-[var(--supplier-on-primary)] shadow-sm"
      : "border-[color-mix(in_srgb,var(--supplier-chip-outline)_28%,transparent)] bg-[var(--supplier-card-background)] text-[var(--supplier-chip-outline)] hover:border-[var(--supplier-chip-outline)] hover:bg-[var(--supplier-primary)] hover:text-[var(--supplier-on-primary)] hover:shadow-sm"
  }`;

function FilterRow({
  options,
  selected,
  onChange,
  ariaLabel,
}: {
  options: CatalogFilterOption[];
  selected: CatalogFilterOption | null;
  onChange: (option: CatalogFilterOption | null) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-pressed={!selected}
        className={`${chipClass(!selected)} snap-start`}
        onClick={() => onChange(null)}
      >
        Todos
      </button>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={selected?.key === option.key}
          className={`${chipClass(selected?.key === option.key)} snap-start`}
          onClick={() => onChange(option)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}

export function SupplierCatalogFilters({
  categories,
  selectedCategory,
  selectedSubcategory,
  onCategoryChange,
  onSubcategoryChange,
  label,
}: SupplierCatalogFiltersProps) {
  const subcategories = selectedCategory?.subcategories ?? [];

  return (
    <div className="space-y-3" aria-label={`Filtros de ${label}`}>
      <FilterRow
        options={categories}
        selected={selectedCategory}
        onChange={onCategoryChange}
        ariaLabel={`Categorías de ${label}`}
      />
      {subcategories.length ? (
        <FilterRow
          options={subcategories}
          selected={selectedSubcategory}
          onChange={onSubcategoryChange}
          ariaLabel={`Subcategorías de ${label}`}
        />
      ) : null}
    </div>
  );
}
