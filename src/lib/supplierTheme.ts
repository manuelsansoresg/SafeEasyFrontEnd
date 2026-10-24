export const SUPPLIER_THEME_DEFAULTS = {
  primary: "#168e00",
  headerBackground: "#004e28",
  pageBackground: "#f2f3f4",
  cardBackground: "#ffffff",
} as const;

export const normalizeThemeColor = (value: string | null | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value! : fallback;

const getRelativeLuminance = (hexColor: string) => {
  const channels = hexColor
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const getReadableTextColor = (backgroundColor: string) => {
  const luminance = getRelativeLuminance(backgroundColor);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
};

export const getContrastRatio = (firstColor: string, secondColor: string) => {
  const lighter = Math.max(
    getRelativeLuminance(firstColor),
    getRelativeLuminance(secondColor),
  );
  const darker = Math.min(
    getRelativeLuminance(firstColor),
    getRelativeLuminance(secondColor),
  );
  return (lighter + 0.05) / (darker + 0.05);
};

export type SupplierThemeSource = {
  primary_color?: string | null;
  header_background_color?: string | null;
  page_background_color?: string | null;
  background_color?: string | null;
  card_background_color?: string | null;
};

// Resolve display values without modifying the supplier or its saved settings.
export function resolveSupplierTheme(supplier: SupplierThemeSource) {
  return {
    primary: normalizeThemeColor(supplier.primary_color, SUPPLIER_THEME_DEFAULTS.primary),
    headerBackground: normalizeThemeColor(supplier.header_background_color, SUPPLIER_THEME_DEFAULTS.headerBackground),
    pageBackground: normalizeThemeColor(
      supplier.page_background_color,
      normalizeThemeColor(supplier.background_color, SUPPLIER_THEME_DEFAULTS.pageBackground),
    ),
    cardBackground: normalizeThemeColor(supplier.card_background_color, SUPPLIER_THEME_DEFAULTS.cardBackground),
  };
}

function mixColor(color: string, target: string, amount: number) {
  const channels = [1, 3, 5].map((offset) => {
    const from = parseInt(color.slice(offset, offset + 2), 16);
    const to = parseInt(target.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

// Keep the chosen hue, adjusting only display text when contrast is insufficient.
export function accessibleThemeColor(color: string, background: string, minimum = 4.5) {
  if (getContrastRatio(color, background) >= minimum) return color;
  const target = getReadableTextColor(background);
  for (let step = 1; step <= 100; step++) {
    const candidate = mixColor(color, target, step / 100);
    if (getContrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target;
}

export function supplierThemeVariables(supplier: SupplierThemeSource) {
  const theme = resolveSupplierTheme(supplier);
  const variables: Record<string, string> = {
    "--supplier-primary": theme.primary,
    "--supplier-secondary": theme.headerBackground,
    "--supplier-header-background": theme.headerBackground,
    "--supplier-page-background": theme.pageBackground,
    "--supplier-card-background": theme.cardBackground,
    "--supplier-primary-hover": theme.primary === SUPPLIER_THEME_DEFAULTS.primary
      ? "#137a00" : mixColor(theme.primary, "#000000", 0.14),
    "--supplier-secondary-hover": theme.headerBackground === SUPPLIER_THEME_DEFAULTS.headerBackground
      ? "#003b1f" : mixColor(theme.headerBackground, "#000000", 0.14),
    "--supplier-on-primary": getReadableTextColor(theme.primary),
    "--supplier-on-header": getReadableTextColor(theme.headerBackground),
    "--supplier-hover-card": theme.cardBackground === "#ffffff" ? "#f3f4f6" : mixColor(theme.cardBackground, getReadableTextColor(theme.cardBackground), 0.06),
    "--supplier-shadow": theme.headerBackground,
  };
  for (const [surface, background] of Object.entries({
    page: theme.pageBackground,
    card: theme.cardBackground,
    primary: theme.primary,
    secondary: theme.headerBackground,
  })) {
    variables[`--supplier-text-on-${surface}`] = getReadableTextColor(background);
    variables[`--supplier-heading-on-${surface}`] = accessibleThemeColor(theme.headerBackground, background);
    variables[`--supplier-accent-on-${surface}`] = accessibleThemeColor(theme.primary, background, 7);
    variables[`--supplier-muted-on-${surface}`] = accessibleThemeColor("#6b7280", background);
  }
  variables["--supplier-on-hover-card"] = getReadableTextColor(variables["--supplier-hover-card"]);
  variables["--supplier-on-primary-hover"] = getReadableTextColor(variables["--supplier-primary-hover"]);
  variables["--supplier-on-secondary-hover"] = getReadableTextColor(variables["--supplier-secondary-hover"]);
  variables["--supplier-rating"] = accessibleThemeColor(
    theme.primary === SUPPLIER_THEME_DEFAULTS.primary && theme.headerBackground === SUPPLIER_THEME_DEFAULTS.headerBackground
      ? SUPPLIER_THEME_DEFAULTS.headerBackground : theme.primary,
    theme.cardBackground,
    3,
  );
  variables["--supplier-chip-outline"] = accessibleThemeColor(theme.primary, theme.cardBackground);
  variables["--supplier-highlight"] = theme.primary === SUPPLIER_THEME_DEFAULTS.primary && theme.headerBackground === SUPPLIER_THEME_DEFAULTS.headerBackground
    ? "#7cde68" : accessibleThemeColor(theme.primary, theme.headerBackground);
  return variables;
}
