import type { DashboardSection } from "@/lib/auth/types";

export type MenuIcon =
  | "home"
  | "store"
  | "chat"
  | "alert"
  | "ranking"
  | "shield"
  | "talento"
  | "reports"
  | "settings";

export type MenuItem = {
  name: string;
  icon: MenuIcon;
  href: string;
  section: DashboardSection;
};

export const menuItems: MenuItem[] = [
  { name: "Inicio", icon: "home", href: "/dashboard", section: "home" },
  { name: "Restaurantes", icon: "store", href: "/dashboard/restaurantes", section: "restaurantes" },
  { name: "Reseñas", icon: "chat", href: "/dashboard/resenas", section: "resenas" },
  { name: "Alertas", icon: "alert", href: "/dashboard/alertas", section: "alertas" },
  { name: "Nexo Prevent", icon: "shield", href: "/dashboard/nexo-prevent", section: "nexo-prevent" },
  { name: "Ranking", icon: "ranking", href: "/dashboard/ranking", section: "ranking" },
  { name: "Talento", icon: "talento", href: "/dashboard/talento", section: "talento" },
  { name: "Informes", icon: "reports", href: "/dashboard/informes", section: "informes" },
];

export const settingsHref = "/dashboard/ajustes";
export const settingsSection: DashboardSection = "ajustes";

export function isMenuItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menú reducido para el usuario de restaurante (solo su local). */
export const restaurantUserMenuItems: MenuItem[] = [
  { name: "Inicio", icon: "home", href: "/dashboard", section: "home" },
  { name: "Reseñas", icon: "chat", href: "/dashboard/resenas", section: "resenas" },
  { name: "Alertas", icon: "alert", href: "/dashboard/alertas", section: "alertas" },
];
