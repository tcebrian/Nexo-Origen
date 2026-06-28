import type { RestaurantDetail, RestaurantOperational, RestaurantsQuery } from "./types";

export type RestaurantsRepository = {
  listOperational(query: RestaurantsQuery): Promise<RestaurantOperational[]>;
  getDetail(slug: string, query: RestaurantsQuery): Promise<RestaurantDetail | null>;
};

let repository: RestaurantsRepository | null = null;

export async function getRestaurantsRepository(): Promise<RestaurantsRepository> {
  if (!repository) {
    const [{ loadPeriodData }, { createRestaurantsRepository }] = await Promise.all([
      import("@/lib/supabase/period-api"),
      import("./restaurants-repository-shared"),
    ]);
    repository = createRestaurantsRepository(loadPeriodData);
  }
  return repository;
}
