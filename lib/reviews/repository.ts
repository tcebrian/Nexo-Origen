import type { Review } from "./types";

export type ReviewsQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type ReviewsRepository = {
  list(query: ReviewsQuery): Promise<Review[]>;
};

let repository: ReviewsRepository | null = null;

export async function getReviewsRepository(): Promise<ReviewsRepository> {
  if (!repository) {
    const { supabaseReviewsRepository } = await import("./supabase-repository");
    repository = supabaseReviewsRepository;
  }
  return repository;
}
