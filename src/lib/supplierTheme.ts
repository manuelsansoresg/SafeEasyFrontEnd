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

type SupplierThemeSource = {
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
