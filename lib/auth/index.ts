export type { AssignedRestaurant, AuthSession, DashboardSection, Perfil, UserRole, UserScope } from "@/lib/auth/types";
export { USER_ROLES } from "@/lib/auth/types";
export { AUTH_ENABLED, DATA_SCOPING_ENABLED } from "@/lib/auth/config";
export { fetchPerfilByUserId, fetchPerfilForAuth } from "@/lib/auth/perfiles";
export { requireApiAuth } from "@/lib/auth/api-auth";
export {
  buildUserInitials,
  canAccessSection,
  canManageUsersAndEmpresas,
  formatRoleLabel,
  isPerfilAuthorized,
  isRestaurantUser,
  isSuperAdmin,
  resolveDisplayName,
  resolveProfileEmpresaLabel,
  belongsToGrupoHambar,
  isGrupoHambarEmpresa,
} from "@/lib/auth/permissions";
export { getAuthSession } from "@/lib/auth/session";
export { fetchUserScope } from "@/lib/auth/scopes";
export { getVisibleBrandCatalog, resolveVisibleBrandCatalog, filterBrandIdsByScope, isBrandInScope, shouldShowBrandFilter } from "@/lib/auth/brand-scope";
export { isRestauranteSlugInScope } from "@/lib/auth/restaurant-guard";
