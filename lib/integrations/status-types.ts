export type IntegrationStatus =
  | "pending"
  | "connected"
  | "syncing"
  | "error"
  | "disabled";

export type RestaurantIntegrationStatusItem = {
  restaurantId: number;
  restaurantName: string;
  city: string | null;
  googleMaps: IntegrationStatus | "missing";
  apify: IntegrationStatus | "missing";
  lastApifyDataAt: string | null;
  issue: string | null;
};

export type IntegrationStatusSnapshot = {
  generatedAt: string;
  activeRestaurants: number;
  googleConnected: number;
  googlePending: number;
  apifyConnected: number;
  apifyPending: number;
  apifyErrors: number;
  activeAgents: number;
  pilotAgents: number;
  lastReviewIngestionAt: string | null;
  restaurants: RestaurantIntegrationStatusItem[];
};
