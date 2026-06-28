import { computePositivesNeeded, REPUTATION_TARGET } from "@/lib/prevent/calculate";

export type GoalRecoveryView = {
  show: boolean;
  targetRating: number;
  currentRating: number;
  positivesNeeded: number;
};

export function resolveGoalRecovery(
  lifetimeRating: number | null | undefined,
  totalReviews: number | null | undefined,
  targetRating = REPUTATION_TARGET
): GoalRecoveryView {
  const count = totalReviews != null && totalReviews > 0 ? totalReviews : null;
  const rating = lifetimeRating != null && lifetimeRating > 0 ? lifetimeRating : null;

  if (count == null || rating == null) {
    return {
      show: false,
      targetRating,
      currentRating: rating ?? 0,
      positivesNeeded: 0,
    };
  }

  if (rating >= targetRating) {
    return {
      show: false,
      targetRating,
      currentRating: rating,
      positivesNeeded: 0,
    };
  }

  const positivesNeeded = computePositivesNeeded(rating, count, targetRating);

  return {
    show: positivesNeeded > 0,
    targetRating,
    currentRating: rating,
    positivesNeeded,
  };
}
