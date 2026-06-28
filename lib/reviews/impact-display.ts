export type ImpactSnapshot = {
  mediaBefore: number | null;
  mediaAfter: number | null;
  impact?: number | null;
};

export type ImpactTone = "negative" | "positive" | "neutral" | "unknown";

export type ImpactSummary = {
  range: string;
  delta: string;
  deltaLong: string;
  tone: ImpactTone;
  headline: string;
  subline: string;
  hasData: boolean;
};

const DELTA_EPSILON = 0.005;

export function resolveImpactDelta(snapshot: ImpactSnapshot): number | null {
  if (snapshot.impact != null && Number.isFinite(snapshot.impact)) {
    return snapshot.impact;
  }
  if (snapshot.mediaBefore != null && snapshot.mediaAfter != null) {
    return snapshot.mediaAfter - snapshot.mediaBefore;
  }
  return null;
}

export function getImpactTone(delta: number | null): ImpactTone {
  if (delta == null) return "unknown";
  if (delta < -DELTA_EPSILON) return "negative";
  if (delta > DELTA_EPSILON) return "positive";
  return "neutral";
}

export function formatMediaRange(snapshot: ImpactSnapshot, decimals = 1): string {
  if (snapshot.mediaAfter == null) return "Sin datos";
  if (snapshot.mediaBefore == null) {
    return `Primera del periodo · ${snapshot.mediaAfter.toFixed(decimals)}`;
  }
  return `${snapshot.mediaBefore.toFixed(decimals)} → ${snapshot.mediaAfter.toFixed(decimals)}`;
}

export function formatDeltaPoints(delta: number | null, decimals = 1): string {
  if (delta == null) return "—";
  if (Math.abs(delta) < DELTA_EPSILON) return "Sin cambio";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(decimals)} pts`;
}

export function formatDeltaPointsLong(delta: number | null, decimals = 1): string {
  if (delta == null) return "Impacto no calculable en el periodo";
  if (Math.abs(delta) < DELTA_EPSILON) return "Sin cambio en la media del local";
  if (delta < 0) {
    return `Bajada de ${Math.abs(delta).toFixed(decimals)} puntos en la media del local`;
  }
  return `Subida de ${delta.toFixed(decimals)} puntos en la media del local`;
}

export function formatImpactSummary(
  snapshot: ImpactSnapshot,
  decimals = 1
): ImpactSummary {
  const delta = resolveImpactDelta(snapshot);
  const range = formatMediaRange(snapshot, decimals);
  const deltaShort = formatDeltaPoints(delta, decimals);
  const deltaLong = formatDeltaPointsLong(delta, decimals);
  const tone = getImpactTone(delta);
  const hasData = snapshot.mediaAfter != null;

  let headline: string;
  let subline: string;

  if (!hasData) {
    headline = "Sin datos";
    subline = "No hay reseñas del local en el periodo";
  } else if (snapshot.mediaBefore == null) {
    headline = snapshot.mediaAfter!.toFixed(decimals);
    subline = "Primera reseña del periodo en este local";
  } else {
    headline = range;
    subline = deltaLong;
  }

  return {
    range,
    delta: deltaShort,
    deltaLong,
    tone,
    headline,
    subline,
    hasData,
  };
}

export function impactToneClass(tone: ImpactTone): string {
  switch (tone) {
    case "negative":
      return "text-red-400";
    case "positive":
      return "text-emerald-400";
    case "neutral":
      return "text-gray-400";
    default:
      return "text-gray-500";
  }
}

/** Texto compacto para listados y celdas (ej. reseñas, alertas). */
export function formatImpactCompact(snapshot: ImpactSnapshot, decimals = 2): string {
  const summary = formatImpactSummary(snapshot, decimals);
  if (!summary.hasData) return "Sin datos de media";
  if (snapshot.mediaBefore == null) {
    return `Primera del periodo · media ${snapshot.mediaAfter!.toFixed(decimals)}`;
  }
  return `${summary.range} (${summary.delta})`;
}
