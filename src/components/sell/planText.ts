const FEATURE_START_PATTERN =
  /\s+(?=(?:Hasta|Perfil|Soporte|Prioridad|Anal[ií]ticas|Acceso|Productos|Gestor|API|Auditor[ií]a|Verificado|Ilimitado)\b)/g;

const cleanLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export const splitPlanDescriptionLines = (value?: string | null) =>
  String(value || '')
    .split(/\r?\n/g)
    .map(cleanLine)
    .filter(Boolean);

export const splitPlanText = (value?: string | null) => {
  const explicitParts = String(value || '')
    .split(/\r?\n|[•;]+/g)
    .map(cleanLine)
    .filter(Boolean);

  if (explicitParts.length > 1) return explicitParts;

  const text = explicitParts[0] || '';
  if (!text) return [];

  return text
    .split(FEATURE_START_PATTERN)
    .map(cleanLine)
    .filter(Boolean);
};

export const normalizePlanFeatures = (features: unknown, fallbackText?: string | null) => {
  if (Array.isArray(features)) {
    const lines = features
      .filter((feature): feature is string => typeof feature === 'string')
      .flatMap(splitPlanText)
      .filter(Boolean);

    if (lines.length > 0) return lines;
  }

  return splitPlanText(fallbackText);
};

export const getPlanFeatureLines = ({
  features,
  description,
  isDirectory,
}: {
  features: unknown;
  description?: string | null;
  isDirectory?: boolean;
}) =>
  isDirectory
    ? splitPlanDescriptionLines(description)
    : normalizePlanFeatures(features, description);
