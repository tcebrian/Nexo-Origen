"use client";

import { createContext, useContext, useMemo } from "react";
import {
  buildUserInitials,
  canAccessSection,
  formatRoleLabel,
  isRestaurantUser,
  normalizeRole,
  resolveDisplayName,
  resolveProfileEmpresaLabel,
  belongsToGrupoHambar,
} from "@/lib/auth/permissions";
import type { AssignedRestaurant, AuthSession, DashboardSection } from "@/lib/auth/types";

type AuthContextValue = AuthSession & {
  displayName: string;
  roleLabel: string;
  initials: string;
  empresaNombre: string;
  showGrupoHambarClientBadge: boolean;
  isRestaurantUser: boolean;
  primaryRestaurant: AssignedRestaurant | null;
  canAccessSection: (section: DashboardSection) => boolean;
  isSuperAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      displayName: resolveDisplayName(session.perfil, session.email),
      roleLabel: formatRoleLabel(session.perfil.rol),
      initials: buildUserInitials(session.perfil.nombre, session.email),
      empresaNombre: resolveProfileEmpresaLabel(
        session.perfil,
        session.scope.empresaNombre
      ),
      showGrupoHambarClientBadge: belongsToGrupoHambar(
        session.perfil,
        session.scope.empresaNombre
      ),
      isRestaurantUser: isRestaurantUser(session.perfil.rol),
      primaryRestaurant: session.assignedRestaurants[0] ?? null,
      canAccessSection: (section) => canAccessSection(session.perfil.rol, section),
      isSuperAdmin: normalizeRole(session.perfil.rol) === "super_admin",
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
