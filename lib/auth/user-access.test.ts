import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canManageUserAccess,
  validateUserAccess,
  type AccessCatalog,
} from "@/lib/auth/user-access";

// Empresa 1 (Grupo): restaurantes 1-4 (marcas 10, 10, 20, 20). Empresa 2 (Otra): restaurante 5 (marca 30).
const catalog: AccessCatalog = {
  empresaIds: new Set([1, 2]),
  restaurants: [
    { id: 1, empresaId: 1, marcaId: 10 },
    { id: 2, empresaId: 1, marcaId: 10 },
    { id: 3, empresaId: 1, marcaId: 20 },
    { id: 4, empresaId: 1, marcaId: 20 },
    { id: 5, empresaId: 2, marcaId: 30 },
  ],
};

describe("validateUserAccess", () => {
  it("restaurante_user admite varios restaurantes de su empresa, ordenados y sin duplicados", () => {
    expect(validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds: [4, 2, 2, 1] }, catalog)).toEqual({
      ok: true,
      value: { rol: "restaurante_user", empresaId: 1, restaurantIds: [1, 2, 4], marcaIds: [] },
    });
  });

  it("restaurante_user sin restaurantes es válido: no ve nada (deny)", () => {
    expect(validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds: [] }, catalog)).toMatchObject({
      ok: true,
      value: { restaurantIds: [] },
    });
  });

  it("un restaurante de otra empresa se rechaza", () => {
    expect(validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds: [1, 5] }, catalog)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no son de la empresa"),
    });
  });

  it("un restaurante inexistente se rechaza", () => {
    expect(validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds: [999] }, catalog).ok).toBe(false);
  });

  it("marca_admin: solo marcas con restaurantes en su empresa", () => {
    expect(validateUserAccess({ rol: "marca_admin", empresaId: 1, marcaIds: [20, 10] }, catalog)).toEqual({
      ok: true,
      value: { rol: "marca_admin", empresaId: 1, restaurantIds: [], marcaIds: [10, 20] },
    });
    expect(validateUserAccess({ rol: "marca_admin", empresaId: 1, marcaIds: [30] }, catalog).ok).toBe(false);
    expect(validateUserAccess({ rol: "marca_admin", empresaId: 2, marcaIds: [10] }, catalog).ok).toBe(false);
  });

  it("empresa_admin no guarda restaurantes ni marcas: ve toda su empresa por el rol", () => {
    expect(
      validateUserAccess({ rol: "empresa_admin", empresaId: 1, restaurantIds: [1, 2], marcaIds: [10] }, catalog)
    ).toEqual({ ok: true, value: { rol: "empresa_admin", empresaId: 1, restaurantIds: [], marcaIds: [] } });
  });

  it("un cambio de rol descarta las listas del rol anterior (no quedan restos que amplíen el acceso)", () => {
    const toMarca = validateUserAccess({ rol: "marca_admin", empresaId: 1, restaurantIds: [1, 2, 3], marcaIds: [10] }, catalog);
    expect(toMarca).toMatchObject({ ok: true, value: { restaurantIds: [], marcaIds: [10] } });

    const toSupervisor = validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds: [3], marcaIds: [10, 20] }, catalog);
    expect(toSupervisor).toMatchObject({ ok: true, value: { restaurantIds: [3], marcaIds: [] } });
  });

  it("super_admin y roles desconocidos no son asignables desde la web", () => {
    for (const rol of ["super_admin", "admin", "", null, undefined, 3]) {
      expect(validateUserAccess({ rol, empresaId: 1 }, catalog).ok).toBe(false);
    }
  });

  it("empresa obligatoria y existente", () => {
    for (const empresaId of [undefined, null, "1", 0, 99, 1.5]) {
      expect(validateUserAccess({ rol: "empresa_admin", empresaId }, catalog).ok).toBe(false);
    }
  });

  it("listas con ids inválidos o de otro tipo se rechazan", () => {
    for (const restaurantIds of ["1", [1, "2"], [0], [-1], [1.5], {}]) {
      expect(validateUserAccess({ rol: "restaurante_user", empresaId: 1, restaurantIds }, catalog).ok).toBe(false);
    }
  });

  it("cuerpo inválido → error", () => {
    expect(validateUserAccess(null, catalog).ok).toBe(false);
    expect(validateUserAccess("x", catalog).ok).toBe(false);
  });
});

describe("canManageUserAccess", () => {
  const admin = { userId: "a", rol: "super_admin" };

  it("solo un super_admin gestiona permisos", () => {
    expect(canManageUserAccess(admin, { userId: "b", rol: "restaurante_user" })).toEqual({ ok: true });
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user", undefined, null]) {
      expect(canManageUserAccess({ userId: "a", rol }, { userId: "b", rol: "restaurante_user" })).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });

  it("un supervisor no puede editar sus propios permisos", () => {
    expect(canManageUserAccess({ userId: "v", rol: "restaurante_user" }, { userId: "v", rol: "restaurante_user" })).toMatchObject({
      ok: false,
    });
  });

  it("ni siquiera un super_admin se edita a sí mismo ni a otro super_admin", () => {
    expect(canManageUserAccess(admin, { userId: "a", rol: "super_admin" }).ok).toBe(false);
    expect(canManageUserAccess(admin, { userId: "z", rol: "super_admin" }).ok).toBe(false);
  });
});

describe("función SQL nexo_set_user_access (migración)", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/user_access_management.sql"), "utf-8");

  it("deja exactamente la selección final y limpia lo que el rol no usa, en una sola función", () => {
    expect(sql).toContain("restaurante_id <> all (v_restaurantes)");
    expect(sql).toContain("marca_id <> all (v_marcas)");
    expect(sql).toContain("p_rol <> 'restaurante_user' or");
    expect(sql).toContain("p_rol <> 'marca_admin' or");
  });

  it("valida en la base de datos la empresa de restaurantes y marcas, y no gestiona super_admin", () => {
    expect(sql).toContain("x.empresa_id = p_empresa_id");
    expect(sql).toContain("x.marca_id = m and x.empresa_id = p_empresa_id");
    expect(sql).toContain("rol no gestionable");
  });

  it("solo la service role puede ejecutarla y hay un único teléfono por usuario", () => {
    expect(sql).toContain("revoke all on function public.nexo_set_user_access");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("create unique index if not exists conv_contactos_usuario_id_key");
    expect(sql).toContain("where usuario_id is not null");
  });
});
