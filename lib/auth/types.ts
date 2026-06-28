import type { BrandId } from "@/app/dashboard/restaurantes/data";

export type AssignedRestaurant = {
  id: number;
  slug: string;
  name: string;
  location: string;
  brand: BrandId;
  brandLabel: string;
};

export const USER_ROLES = [
  "super_admin",
  "empresa_admin",
  "marca_admin",
  "restaurante_user",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Secciones del dashboard con control de acceso */
export type DashboardSection =
  | "home"
  | "restaurantes"
  | "resenas"
  | "alertas"
  | "nexo-prevent"
  | "ranking"
  | "talento"
  | "informes"
  | "ajustes"
  | "insights-ia";

export type Perfil = {
  id: string;
  userId: string;
  rol: UserRole;
  nombre: string | null;
  email: string | null;
  empresaId: string | null;
};

/**
 * Alcance de datos del usuario, resuelto desde Supabase.
 * `null` en ids = acceso sin restricción a ese nivel (solo super_admin).
 */
export type UserScope = {
  rol: UserRole;
  empresaId: string | null;
  empresaNombre: string | null;
  /** null = todas las marcas permitidas por rol */
  marcaIds: number[] | null;
  /** null = todos los restaurantes permitidos por rol */
  restauranteIds: number[] | null;
  /** null = todas las marcas visibles en filtros UI */
  brandIds: BrandId[] | null;
};

export type AuthSession = {
  userId: string;
  email: string;
  perfil: Perfil;
  scope: UserScope;
  /** Restaurantes asignados (usuario de restaurante). */
  assignedRestaurants: AssignedRestaurant[];
};
