/**
 * Tamaño de letra de "Análisis Nexo" según lo que ocupa realmente el texto.
 *
 * La columna de IA de las 8 plantillas de alerta tiene un alto FIJO:
 * "Diagnóstico Nexo" queda anclado abajo, siempre en el mismo sitio y por
 * encima de la conclusión, y "Análisis Nexo" ocupa el hueco que queda. Lo
 * único que cambia con el texto es el tamaño de letra: se elige el mayor
 * tamaño en el que las cuatro filas caben enteras (sin cortar el texto ni
 * empujar Diagnóstico hacia abajo).
 *
 * Antes se elegía solo por el nº total de caracteres sin mirar el ancho de la
 * columna, y con textos normales el tamaño "grande" no cabía: las filas
 * crecían y Diagnóstico acababa pisando la conclusión.
 *
 * Los números de TIERS tienen que coincidir con el bloque "Columna de IA:
 * encaje fijo" del final de cada `*-alert.css`.
 */

export type InsightsTier = "lg" | "md" | "sm" | "xs";

type TierMetrics = {
  /** Tamaño y interlineado del texto (px del lienzo de 1600 px). */
  value: number;
  lineHeight: number;
  /** Tamaño de la etiqueta ("RESUMEN IA"…). */
  label: number;
  /** Relleno vertical de cada fila (arriba y abajo). */
  padding: number;
  /** Diámetro del icono circular de la fila. */
  icon: number;
};

const TIERS: Record<InsightsTier, TierMetrics> = {
  lg: { value: 22, lineHeight: 1.3, label: 17, padding: 8, icon: 56 },
  md: { value: 20, lineHeight: 1.3, label: 16, padding: 8, icon: 56 },
  sm: { value: 18, lineHeight: 1.28, label: 15, padding: 7, icon: 52 },
  xs: { value: 16, lineHeight: 1.25, label: 14, padding: 6, icon: 46 },
};

const TIER_ORDER: InsightsTier[] = ["lg", "md", "sm", "xs"];

/** Alto disponible para las filas de Análisis Nexo (medido en el lienzo real). */
export const ANALYSIS_AREA_HEIGHT = 414;

/**
 * Ancho medio de un carácter en em, calibrado midiendo texto real en las
 * plantillas: con 0,52 la estimación nunca se queda por debajo de la altura
 * real (40 medidas) y sobra un ~5 %.
 */
const AVG_CHAR_WIDTH_EM = 0.52;
const LABEL_LINE_HEIGHT = 1.2;
const LABEL_GAP = 4;

function estimateLines(text: string, charsPerLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    // Palabras más largas que la línea se parten (overflow-wrap).
    let remaining = word.length;
    if (used > 0 && used + 1 + remaining <= charsPerLine) {
      used += 1 + remaining;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    while (remaining > charsPerLine) {
      lines += 1;
      remaining -= charsPerLine;
    }
    used = remaining;
  }
  return lines;
}

/**
 * @param values Los textos de las filas de Análisis Nexo que se van a pintar.
 * @param copyWidth Ancho máximo (px) del texto de cada fila en la plantilla (`__copy`).
 */
export function pickInsightsTier(values: string[], copyWidth: number): InsightsTier {
  const rows = values.filter((value) => value.trim().length > 0);
  if (rows.length === 0) return "lg";

  for (const tier of TIER_ORDER) {
    const metrics = TIERS[tier];
    const charsPerLine = Math.max(1, Math.floor(copyWidth / (metrics.value * AVG_CHAR_WIDTH_EM)));
    const total = rows.reduce((sum, value) => {
      const textHeight =
        metrics.label * LABEL_LINE_HEIGHT + LABEL_GAP + estimateLines(value, charsPerLine) * metrics.value * metrics.lineHeight;
      return sum + Math.max(textHeight, metrics.icon) + metrics.padding * 2;
    }, 0);
    if (total <= ANALYSIS_AREA_HEIGHT) return tier;
  }
  return "xs";
}

/**
 * Longitud máxima de cada texto de Análisis Nexo. Con estos límites, incluso
 * los cuatro textos al máximo caben en la columna con el tamaño de letra más
 * pequeño; un texto más largo se corta en una palabra y termina en "…" en vez
 * de empujar o tapar otras cajas (el texto completo sigue en la reseña).
 */
const MAX_INSIGHT_CHARS: Record<string, number> = {
  resumen: 200,
  motivo: 120,
  impacto: 110,
  recomendacion: 230,
};

export function limitInsightText(key: string, value: string): string {
  const max = MAX_INSIGHT_CHARS[key];
  const text = value.replace(/\s+/g, " ").trim();
  if (!max || text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
