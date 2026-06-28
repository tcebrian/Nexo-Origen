/** Garantiza al menos 2 puntos para renderizar líneas SVG. */
export function ensureChartPoints<T extends string | number>(
  values: number[],
  labels: T[],
  minPoints = 2
): { values: number[]; labels: T[] } {
  if (values.length >= minPoints) {
    return { values, labels };
  }

  if (values.length === 1) {
    return {
      values: [values[0], values[0]],
      labels: [labels[0], labels[0]],
    };
  }

  return { values, labels };
}
