import type { RestaurantFilters, RestaurantOperational } from "./types";

const statusOrder = { critical: 0, watch: 1, on_target: 2 };

export function filterRestaurants(
  items: RestaurantOperational[],
  filters: RestaurantFilters
): RestaurantOperational[] {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.brand !== "todas" && item.brand !== filters.brand) return false;
    if (filters.status !== "todos" && item.status !== filters.status) return false;
    if (
      query &&
      !item.name.toLowerCase().includes(query) &&
      !item.location.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function sortRestaurants(
  items: RestaurantOperational[],
  sort: RestaurantFilters["sort"]
): RestaurantOperational[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sort) {
      case "media-desc":
        return b.currentMedia - a.currentMedia;
      case "media-asc":
        return a.currentMedia - b.currentMedia;
      case "alerts-desc":
        return b.activeAlerts - a.activeAlerts || a.protectionLevel - b.protectionLevel;
      case "name-asc":
        return a.name.localeCompare(b.name, "es");
      case "risk":
      default:
        return (
          (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
          a.protectionLevel - b.protectionLevel
        );
    }
  });

  return sorted;
}

export function applyRestaurantFilters(
  items: RestaurantOperational[],
  filters: RestaurantFilters
) {
  return sortRestaurants(filterRestaurants(items, filters), filters.sort);
}
