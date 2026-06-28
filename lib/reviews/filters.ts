import { getPrioritySortScore } from "./classify";
import type { Review, ReviewFilters, ReviewSort, ReviewStats } from "./types";

export function getReviewStats(reviews: Review[]): ReviewStats {
  const total = reviews.length;
  const positives = reviews.filter((r) => r.sentiment === "positiva").length;
  const negatives = reviews.filter((r) => r.sentiment === "negativa").length;
  const unreviewed = reviews.filter((r) => !r.reviewed).length;
  const avg = total === 0 ? 0 : reviews.reduce((sum, review) => sum + review.rating, 0) / total;

  return {
    total,
    positives,
    negatives,
    unreviewed,
    avg: avg.toFixed(1),
    positivePct: total === 0 ? 0 : Math.round((positives / total) * 100),
    negativePct: total === 0 ? 0 : Math.round((negatives / total) * 100),
    changePct: 0,
  };
}

export function filterReviews(reviews: Review[], filters: ReviewFilters) {
  return reviews.filter((review) => {
    if (filters.negativesOnly && review.sentiment !== "negativa") return false;
    if (filters.unreviewedOnly && review.reviewed) return false;
    if (filters.brand !== "todas" && review.brand !== filters.brand) return false;
    if (filters.restaurant !== "todos" && review.restaurantSlug !== filters.restaurant) return false;
    if (filters.stars !== "todas" && review.rating !== Number(filters.stars)) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      return (
        review.author.toLowerCase().includes(q) ||
        review.text.toLowerCase().includes(q) ||
        review.restaurant.toLowerCase().includes(q) ||
        review.brandLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function sortReviewsByPriority(reviews: Review[]) {
  return [...reviews].sort((a, b) => {
    const scoreDiff = getPrioritySortScore(a) - getPrioritySortScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return b.date.getTime() - a.date.getTime();
  });
}

export function sortReviews(reviews: Review[], sortBy: ReviewSort) {
  const sorted = [...reviews];

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "rating-desc":
        return b.rating - a.rating || b.date.getTime() - a.date.getTime();
      case "rating-asc":
        return a.rating - b.rating || b.date.getTime() - a.date.getTime();
      case "priority":
        return sortReviewsByPriority([a, b])[0] === a ? -1 : 1;
      default:
        return b.date.getTime() - a.date.getTime();
    }
  });

  return sorted;
}

export function isUrgentReview(review: Review) {
  return review.sentiment === "negativa" || review.rating <= 2;
}

export function getLatestUrgentReviews(reviews: Review[], limit = 5, restaurant?: string) {
  const pool = reviews.filter((review) => {
    if (!isUrgentReview(review)) return false;
    if (restaurant && restaurant !== "todos" && review.restaurant !== restaurant) return false;
    return true;
  });

  return sortReviewsByPriority(pool).slice(0, limit);
}

export function getNegativeCountByRestaurant(reviews: Review[]) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    if (!isUrgentReview(review)) continue;
    counts.set(review.restaurant, (counts.get(review.restaurant) ?? 0) + 1);
  }
  return counts;
}

export type RestaurantSentimentFilter = "todas" | "negativas" | "positivas";

export type RestaurantReviewStats = {
  total: number;
  negatives: number;
  positives: number;
};

export function getStatsByRestaurant(reviews: Review[]) {
  const stats = new Map<string, RestaurantReviewStats>();
  for (const review of reviews) {
    const current = stats.get(review.restaurant) ?? { total: 0, negatives: 0, positives: 0 };
    current.total += 1;
    if (review.sentiment === "negativa") current.negatives += 1;
    if (review.sentiment === "positiva") current.positives += 1;
    stats.set(review.restaurant, current);
  }
  return stats;
}

export function filterReviewsBySentiment(reviews: Review[], filter: RestaurantSentimentFilter) {
  if (filter === "negativas") return reviews.filter((r) => r.sentiment === "negativa");
  if (filter === "positivas") return reviews.filter((r) => r.sentiment === "positiva");
  return reviews;
}

export function getReviewVolumeTrend(reviews: Review[], points = 12): number[] {
  if (reviews.length === 0) return Array(points).fill(0);

  const sorted = [...reviews].sort((a, b) => a.date.getTime() - b.date.getTime());
  const min = sorted[0].date.getTime();
  const max = sorted[sorted.length - 1].date.getTime();
  const span = Math.max(max - min, 1);
  const buckets = Array(points).fill(0);

  for (const review of reviews) {
    const idx = Math.min(points - 1, Math.floor(((review.date.getTime() - min) / span) * points));
    buckets[idx] += 1;
  }

  return buckets;
}

export function getReviewRatingTrend(reviews: Review[], points = 12): number[] {
  if (reviews.length === 0) return Array(points).fill(0);

  const sorted = [...reviews].sort((a, b) => a.date.getTime() - b.date.getTime());
  const min = sorted[0].date.getTime();
  const max = sorted[sorted.length - 1].date.getTime();
  const span = Math.max(max - min, 1);
  const buckets: { sum: number; count: number }[] = Array.from({ length: points }, () => ({
    sum: 0,
    count: 0,
  }));

  for (const review of reviews) {
    const idx = Math.min(points - 1, Math.floor(((review.date.getTime() - min) / span) * points));
    buckets[idx].sum += review.rating;
    buckets[idx].count += 1;
  }

  return buckets.map((b) => (b.count === 0 ? 0 : b.sum / b.count));
}
