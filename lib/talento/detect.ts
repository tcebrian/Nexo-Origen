import type { EmployeeMention, EmployeeRecord, MentionSentiment } from "./types";

/**
 * Resultado de detección IA de nombres en reseñas.
 * Conectar con pipeline NLP / Supabase Edge Function.
 */
export type DetectedNameMention = {
  name: string;
  normalizedName: string;
  reviewId: string;
  restaurant: string;
  restaurantSlug: string;
  brand: EmployeeRecord["brand"];
  excerpt: string;
  sentiment: MentionSentiment;
  motives: string[];
  confidence: number;
  detectedAt: Date;
};

export function normalizeEmployeeName(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function toEmployeeMention(detection: DetectedNameMention): EmployeeMention {
  return {
    reviewId: detection.reviewId,
    restaurant: detection.restaurant,
    restaurantSlug: detection.restaurantSlug,
    sentiment: detection.sentiment,
    motive: detection.motives[0],
    excerpt: detection.excerpt,
    date: detection.detectedAt,
  };
}

/**
 * Agrega detecciones IA en registros de empleado.
 * Usar cuando el pipeline de reseñas esté conectado a Supabase.
 */
export function aggregateDetectedMentions(detections: DetectedNameMention[]): Map<string, EmployeeMention[]> {
  const byName = new Map<string, EmployeeMention[]>();

  for (const detection of detections) {
    const key = normalizeEmployeeName(detection.normalizedName || detection.name);
    const list = byName.get(key) ?? [];
    list.push(toEmployeeMention(detection));
    byName.set(key, list);
  }

  return byName;
}
