import type { DashboardSection, Perfil, UserRole, UserScope } from "@/lib/auth/types";
import { DATA_SCOPING_ENABLED } from "@/lib/auth/config";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super administrador",
  empresa_admin: "Administrador de empresa",
  marca_admin: "Administrador de marca",
  restaurante_user: "Usuario de restaurante",
};

/** Secciones restringidas solo a super_admin */
const SUPER_ADMIN_ONLY: DashboardSection[] = ["talento", "informes", "ajustes"];

/** Secciones visibles para empresa_admin y marca_admin */
const ORG_ADMIN_SECTIONS: DashboardSection[] = [
  "home",
  "restaurantes",
  "resenas",
  "alertas",
  "nexo-prevent",
  "ranking",
  "insights-ia",
];

/** Secciones visibles para restaurante_user */
const RESTAURANTE_USER_SECTIONS: DashboardSection[] = [
  "home",
  "resenas",
  "alertas",
];

export function normalizeRole(rol: string | null | undefined): UserRole | null {
  const value = rol?.trim();
  if (!value) return null;
  if (value === "admin") return "empresa_admin";
  if (value === "manager") return "marca_admin";
  if (value === "viewer") return "restaurante_user";
  if (
    value === "super_admin" ||
    value === "empresa_admin" ||
    value === "marca_admin" ||
    value === "restaurante_user"
  ) {
    return value;
  }
  return null;
}

export function isPerfilAuthorized(perfil: Perfil | null | undefined): boolean {
  if (!perfil) return false;
  return normalizeRole(perfil.rol) !== null;
}

export function isSuperAdmin(rol: UserRole | null | undefined): boolean {
  return rol === "super_admin";
}

/** @deprecated Usar isSuperAdmin */
export function hasFullAccess(rol: UserRole | null | undefined): boolean {
  return isSuperAdmin(normalizeRole(rol ?? null));
}

export function canManageUsersAndEmpresas(rol: UserRole | null | undefined): boolean {
  return isSuperAdmin(rol);
}

export function isRestaurantUser(rol: UserRole | string | null | undefined): boolean {
  return normalizeRole(rol ?? null) === "restaurante_user";
}

export function canAccessSection(rol: UserRole | null | undefined, section: DashboardSection): boolean {
  const normalized = normalizeRole(rol ?? null);
  if (!normalized) return false;

  if (SUPER_ADMIN_ONLY.includes(section)) {
    return isSuperAdmin(normalized);
  }

  if (isSuperAdmin(normalized)) {
    return true;
  }

  if (normalized === "restaurante_user") {
    return RESTAURANTE_USER_SECTIONS.includes(section);
  }

  return ORG_ADMIN_SECTIONS.includes(section);
}

export function getAccessibleSections(rol: UserRole | null | undefined): DashboardSection[] {
  const all: DashboardSection[] = [
    ...RESTAURANTE_USER_SECTIONS,
    "nexo-prevent",
    "insights-ia",
    ...SUPER_ADMIN_ONLY,
  ];
  const unique = [...new Set(all)];
  return unique.filter((section) => canAccessSection(rol, section));
}

export function formatRoleLabel(rol: UserRole | string | null | undefined): string {
  if (!rol) return "Usuario";
  const normalized = normalizeRole(String(rol));
  if (normalized) return ROLE_LABELS[normalized];
  return String(rol).replace(/_/g, " ");
}

export function buildUserInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const source = (name?.trim() || email?.trim() || "U").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function resolveDisplayName(
  perfil: Pick<Perfil, "nombre" | "email"> | null | undefined,
  fallbackEmail?: string | null
): string {
  return perfil?.nombre?.trim() || perfil?.email?.trim() || fallbackEmail?.trim() || "Usuario";
}

function normalizeEmpresaKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** true si el nombre de empresa corresponde a Grupo Hámbar. */
export function isGrupoHambarEmpresa(empresaNombre: string | null | undefined): boolean {
  const key = normalizeEmpresaKey(empresaNombre ?? "");
  return key.includes("grupo hambar");
}

/** Usuarios del cliente Grupo Hámbar (no super_admin ni otras empresas). */
export function belongsToGrupoHambar(
  perfil: Pick<Perfil, "rol" | "empresaId">,
  empresaNombre: string | null | undefined
): boolean {
  if (isSuperAdmin(normalizeRole(perfil.rol))) return false;
  return isGrupoHambarEmpresa(empresaNombre);
}

/**
 * Etiqueta de organización en perfil / sidebar.
 * super_admin no pertenece a un cliente concreto (p. ej. Grupo Hambar).
 */
export function resolveProfileEmpresaLabel(
  perfil: Pick<Perfil, "rol" | "empresaId">,
  empresaNombre: string | null | undefined
): string {
  if (isSuperAdmin(normalizeRole(perfil.rol))) {
    return "Nexo Origen";
  }

  const trimmed = empresaNombre?.trim();
  if (trimmed) return trimmed;

  if (perfil.empresaId) {
    return "Empresa asignada";
  }

  return "Sin empresa asignada";
}

/** true si el scope no restringe datos (super_admin o fase 1 sin filtrado) */
export function isUnrestrictedScope(scope: UserScope): boolean {
  if (isSuperAdmin(scope.rol)) return true;
  if (!DATA_SCOPING_ENABLED) return true;
  return false;
}

export function canAccessRestaurante(scope: UserScope, restauranteId: number): boolean {
  if (isUnrestrictedScope(scope)) return true;
  if (!scope.restauranteIds?.length) return false;
  return scope.restauranteIds.includes(restauranteId);
}

export function canAccessMarca(scope: UserScope, marcaId: number): boolean {
  if (isSuperAdmin(scope.rol)) return true;
  if (scope.marcaIds === null && scope.empresaId) return true;
  if (!scope.marcaIds?.length) return false;
  return scope.marcaIds.includes(marcaId);
}
