import { formatImpactCompact } from "@/lib/reviews/impact-display";
import { classifyReviewReason, type ReviewPrimaryReason } from "@/lib/reviews/classify-reason";
import { REVIEW_CATEGORY_LABELS, type ReviewCategory, type ReviewPriority, type ReviewSentiment } from "./types";

export function reasonToCategory(reason: ReviewPrimaryReason): ReviewCategory {
  switch (reason) {
    case "Tiempo de espera":
      return "tiempo_espera";
    case "Atención al cliente":
      return "atencion";
    case "Calidad producto":
      return "calidad_producto";
    case "Limpieza":
      return "limpieza";
    case "Pedido incorrecto":
      return "error_pedido";
    case "Falta de producto":
      return "falta_producto";
    default:
      return "otros";
  }
}

export function detectReviewCategory(text: string, rating: number): ReviewCategory {
  return reasonToCategory(classifyReviewReason({ comentario: text }));
}
export function getReviewPriority(
  rating: number,
  sentiment: ReviewSentiment,
  category: ReviewCategory
): ReviewPriority {
  if (rating === 1) return "Alta";
  if (rating === 2 && (category === "tiempo_espera" || category === "atencion")) return "Alta";
  if (rating === 2 || sentiment === "negativa") return "Media";
  if (sentiment === "neutral") return "Media";
  return "Baja";
}

export function getEstimatedImpact(
  _rating: number,
  _sentiment: ReviewSentiment,
  mediaImpact?: { mediaBefore: number | null; mediaAfter: number; impact: number } | null
): string {
  if (mediaImpact) {
    return formatImpactCompact(mediaImpact, 2);
  }
  return "Sin datos de media en el periodo";
}

export function getRecommendedAction(category: ReviewCategory, priority: ReviewPriority): string {
  switch (category) {
    case "tiempo_espera":
      return "Revisar tiempos de servicio en turno de comida y dotación en franjas punta.";
    case "atencion":
      return "Reforzar protocolo de atención en sala y caja; briefing con el equipo de turno.";
    case "calidad_producto":
      return "Auditar línea de montaje y tiempos entre preparación y entrega.";
    case "limpieza":
      return "Incrementar rondas de limpieza en sala durante el servicio.";
    case "error_pedido":
      return "Revisar proceso de verificación de pedidos en caja y entrega.";
    case "falta_producto":
      return "Verificar disponibilidad de producto y comunicación proactiva al cliente.";
    default:
      if (priority === "Alta") {
        return "Contactar al local y revisar la incidencia antes del próximo turno.";
      }
      if (priority === "Baja") {
        return "Compartir el feedback positivo con el equipo y documentar buenas prácticas.";
      }
      return "Monitorizar la evolución y responder a la reseña en las próximas 48 h.";
  }
}

export function getCategoryLabel(category: ReviewCategory): string {
  return REVIEW_CATEGORY_LABELS[category];
}

export {
  classifyReviewReason,
  getMotivoPrincipal,
  reasonToSlug,
  type ReviewPrimaryReason,
  REVIEW_PRIMARY_REASONS,
} from "./classify-reason";

export function getPrioritySortScore(review: {
  rating: number;
  sentiment: ReviewSentiment;
  priority: ReviewPriority;
}): number {
  const isCritical =
    review.rating === 1 || (review.sentiment === "negativa" && review.priority === "Alta");
  if (isCritical) return 0;
  if (review.sentiment === "negativa") return 1;
  if (review.sentiment === "neutral") return 2;
  return 3;
}
