import type { RestaurantAlert } from "./types";

export type AlertsQuery = {
  tenantId: string;
  start: Date;
  end: Date;
};

export type AlertsRepository = {
  list(query: AlertsQuery): Promise<RestaurantAlert[]>;
  resolvedCountThisWeek(): Promise<number>;
};

let repository: AlertsRepository | null = null;

export async function getAlertsRepository(): Promise<AlertsRepository> {
  if (!repository) {
    const { supabaseAlertsRepository } = await import("./supabase-repository");
    repository = supabaseAlertsRepository;
  }
  return repository;
}
