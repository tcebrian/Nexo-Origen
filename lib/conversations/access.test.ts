import { describe, expect, it } from "vitest";
import { authorizeConversationsAccess, canReadConversations } from "@/lib/conversations/access";
import { canAccessSection } from "@/lib/auth/permissions";
import { canAccessDashboardPath, isSuperAdminApiPath } from "@/lib/auth/route-guard";

describe("acceso a Conversations", () => {
  it("solo super_admin puede leer", () => {
    expect(canReadConversations("super_admin")).toBe(true);
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user", "admin", "manager", "viewer", "", null, undefined, "otro"])(
    "rechaza el rol %s",
    (rol) => {
      expect(canReadConversations(rol as string | null | undefined)).toBe(false);
    }
  );

  it("sin sesión: 401; rol no permitido: 403; super_admin: ok", () => {
    expect(authorizeConversationsAccess(null)).toMatchObject({ ok: false, status: 401 });
    expect(authorizeConversationsAccess({ perfil: { rol: "empresa_admin" } })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeConversationsAccess({ perfil: { rol: "super_admin" } })).toEqual({ ok: true });
  });

  it("la sección y la ruta del dashboard son solo para super_admin", () => {
    expect(canAccessSection("super_admin", "conversaciones")).toBe(true);
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"] as const) {
      expect(canAccessSection(rol, "conversaciones")).toBe(false);
      expect(canAccessDashboardPath(rol, "/dashboard/conversaciones")).toBe(false);
    }
    expect(canAccessDashboardPath("super_admin", "/dashboard/conversaciones")).toBe(true);
  });

  it("las APIs de conversaciones se tratan como rutas solo super_admin en middleware", () => {
    expect(isSuperAdminApiPath("/api/conversations")).toBe(true);
    expect(isSuperAdminApiPath("/api/conversations/abc/messages")).toBe(true);
  });
});
