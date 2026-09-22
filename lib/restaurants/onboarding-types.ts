export type RestaurantOnboardingOption = {
  id: number;
  nombre: string;
};

export type RestaurantOnboardingOptions = {
  marcas: RestaurantOnboardingOption[];
  empresas: RestaurantOnboardingOption[];
};

export type RestaurantOnboardingInput = {
  nombre: string;
  direccion?: string;
  ciudad?: string;
  marcaId: number;
  empresaId: number;
  placeId: string;
  googleMapsUrl?: string;
};

export type RestaurantOnboardingResult = {
  id: number;
  nombre: string;
  integrations: {
    googleMaps: "connected";
    apify: "pending";
  };
};
