const FEATURE_START_PATTERN =
  /\s+(?=(?:Hasta|Perfil|Soporte|Prioridad|Anal[ií]ticas|Acceso|Productos|Gestor|API|Auditor[ií]a|Verificado|Ilimitado)\b)/g;

const cleanLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export const splitPlanText = (value?: string | null) => {
  const text = cleanLine(String(value || ''));
  if (!text) return [];

  const explicitParts = text
    .split(/\r?\n|[•;]+/g)
    .map(cleanLine)
    .filter(Boolean);

  if (explicitParts.length > 1) return explicitParts;

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
