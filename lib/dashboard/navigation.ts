import type { MenuItem } from "@/app/dashboard/_components/menu";
import type { DashboardSection } from "@/lib/auth/types";

/**
 * Organización VISUAL del menú lateral: qué secciones van como navegación principal y cuáles dentro
 * de "Más". No decide permisos ni rutas: recibe los elementos YA filtrados por rol
 * (`canAccessSection`) y solo los reparte y los ordena. Un elemento que no figure en ninguna lista
 * (una sección nueva) cae dentro de "Más": nada desaparece del menú.
 */

export type NavLayout = "desktop" | "mobile";

const LAYOUTS: Record<NavLayout, { main: DashboardSection[]; more: DashboardSection[] }> = {
  desktop: {
    main: ["home", "restaurantes", "resenas", "conversaciones", "alertas", "informes"],
    more: ["ranking", "nexo-prevent", "talento", "agentes", "integraciones", "usuarios", "ajustes"],
  },
  // Móvil: 4 accesos en la barra inferior + "Más" con todo lo demás.
  mobile: {
    main: ["home", "resenas", "conversaciones", "alertas"],
    more: ["restaurantes", "informes", "ranking", "nexo-prevent", "talento", "agentes", "integraciones", "usuarios", "ajustes"],
  },
};

export function buildNavigation(items: MenuItem[], layout: NavLayout): { main: MenuItem[]; more: MenuItem[] } {
  const { main, more } = LAYOUTS[layout];
  const pick = (order: DashboardSection[]) =>
    order.map((section) => items.find((item) => item.section === section)).filter((item): item is MenuItem => Boolean(item));

  const listed = new Set<DashboardSection>([...main, ...more]);
  const unlisted = items.filter((item) => !listed.has(item.section));
  return { main: pick(main), more: [...pick(more), ...unlisted] };
}

/** ¿Alguna opción de "Más" es la página actual? (abre el desplegable y resalta "Más"). */
export function hasActiveItem(items: MenuItem[], pathname: string, isActive: (pathname: string, href: string) => boolean): boolean {
  return items.some((item) => isActive(pathname, item.href));
}
