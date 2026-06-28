const DEFAULT_MAX_LENGTH = 140;

export function truncateByLength(text: string, maxLength = DEFAULT_MAX_LENGTH) {
  const normalized = text.trim() || "Sin comentario";
  if (normalized.length <= maxLength) {
    return { display: normalized, isTruncated: false };
  }

  const slice = normalized.slice(0, maxLength).trimEnd();
  const breakAt = Math.max(slice.lastIndexOf(" "), Math.floor(maxLength * 0.6));
  const display = breakAt > 0 ? `${slice.slice(0, breakAt).trimEnd()}…` : `${slice}…`;

  return { display, isTruncated: true };
}

export function getReviewHref(reviewId: string) {
  return `/dashboard/resenas/${reviewId}#comentario`;
}

/** Alertas usan id `review-{reviewId}`. */
export function getReviewHrefFromAlertId(alertId: string): string | null {
  if (!alertId.startsWith("review-")) return null;
  const reviewId = alertId.slice("review-".length);
  return reviewId ? getReviewHref(reviewId) : null;
}
