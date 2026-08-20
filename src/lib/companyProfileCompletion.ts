export type CompanyProfileSection = {
  id: "information" | "logo" | "location" | "header" | "hours" | "contact";
  label: string;
  complete: boolean;
};

type CompanyRecord = Record<string, unknown>;

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;

const hasLocation = (supplier: CompanyRecord) =>
  hasText(supplier.map_location) ||
  (hasText(supplier.city) && (hasText(supplier.address) || hasText(supplier.state)));

export function getCompanyProfileCompletion(
  supplier: CompanyRecord,
  options: { isDirectory: boolean },
) {
  const sections: CompanyProfileSection[] = [
    {
      id: "information",
      label: "Información básica",
      complete:
        hasText(supplier.name) &&
        (hasText(supplier.short_description) || hasText(supplier.description)),
    },
    {
      id: "logo",
      label: "Logo",
      complete: hasText(supplier.logo) || hasText(supplier.logo_url),
    },
    {
      id: "location",
      label: "Ubicación",
      complete: hasLocation(supplier),
    },
    {
      id: "header",
      label: "Encabezado",
      complete:
        hasItems(supplier.carousel_images) ||
        hasItems(supplier.carousel) ||
        hasText(supplier.header_video),
    },
    {
      id: "hours",
      label: "Horarios",
      complete: hasItems(supplier.business_hours) || hasItems(supplier.businessHours),
    },
    {
      id: "contact",
      label: options.isDirectory ? "Contacto y redes" : "Contacto",
      complete:
        hasText(supplier.phone) ||
        hasText(supplier.facebook_url) ||
        hasText(supplier.instagram_url) ||
        hasText(supplier.x_url),
    },
  ];

  if (options.isDirectory) {
    sections[0] = {
      ...sections[0],
      complete:
        sections[0].complete &&
        (Number.isFinite(Number(supplier.category_id)) || hasText(supplier.category_name)),
    };
  }

  const completed = sections.filter((section) => section.complete).length;
  return {
    percentage: Math.round((completed / sections.length) * 100),
    completed,
    total: sections.length,
    sections,
  };
}
