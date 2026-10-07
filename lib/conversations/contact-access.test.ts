import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTACT_TYPES,
  contactTypeLabel,
  isContactType,
  resolveRestaurantIds,
  validateContactAccess,
  type ContactAccessCatalog,
  type ContactGrants,
} from "@/lib/conversations/contact-access";

// Empresa 1 (Grupo): BK Zizur 1, BK Tudela 2, BK Soria 3, Popeyes Tudela 4, Popeyes Logroño 5. Empresa 2: Vault 6.
const restaurants = [
  { id: 1, empresaId: 1 },
  { id: 2, empresaId: 1 },
  { id: 3, empresaId: 1 },
  { id: 4, empresaId: 1 },
  { id: 5, empresaId: 1 },
  { id: 6, empresaId: 2 },
];
const catalog: ContactAccessCatalog = { empresaIds: new Set([1, 2]), restaurants };

const grants = (over: Partial<ContactGrants>): ContactGrants => ({ empresas: [], restaurantes: [], ...over });
const selected = (ids: number[], empresaId = 1) => ids.map((restauranteId) => ({ empresaId, restauranteId }));

describe("resolveRestaurantIds", () => {
  it("sin empresa ni asignaciones → ninguno (deny by default)", () => {
    expect(resolveRestaurantIds(grants({}), restaurants)).toEqual([]);
  });

  it("selección explícita de 3 restaurantes → exactamente esos 3", () => {
    const result = resolveRestaurantIds(
      grants({ empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: selected([1, 2, 4]) }),
      restaurants
    );
    expect(result).toEqual([1, 2, 4]);
  });

  it("mezcla marcas libremente (BK + Popeyes)", () => {
    // Víctor: BK Zizur (1), BK Tudela (2), Popeyes Tudela (4); BK Soria (3) no.
    const result = resolveRestaurantIds(
      grants({ empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: selected([4, 1, 2]) }),
      restaurants
    );
    expect(result).toEqual([1, 2, 4]);
    expect(result).not.toContain(3);
  });

  it("todos_restaurantes → todos los restaurantes de la empresa (y ninguno de otra)", () => {
    expect(resolveRestaurantIds(grants({ empresas: [{ empresaId: 1, todosRestaurantes: true }] }), restaurants)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("un restaurante nuevo entra solo con todos=true, y NO con selección explícita", () => {
    const withNew = [...restaurants, { id: 7, empresaId: 1 }];
    const all = grants({ empresas: [{ empresaId: 1, todosRestaurantes: true }] });
    const explicit = grants({ empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: selected([1, 2]) });

    expect(resolveRestaurantIds(all, withNew)).toContain(7);
    expect(resolveRestaurantIds(explicit, withNew)).toEqual([1, 2]);
  });

  it("con todos=true se ignoran las filas de restaurantes sobrantes", () => {
    const result = resolveRestaurantIds(
      grants({ empresas: [{ empresaId: 1, todosRestaurantes: true }], restaurantes: selected([1]) }),
      restaurants
    );
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("restaurantes de otra empresa no cuentan aunque haya una fila (integridad defensiva)", () => {
    expect(
      resolveRestaurantIds(
        grants({ empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: [...selected([1]), { empresaId: 1, restauranteId: 6 }] }),
        restaurants
      )
    ).toEqual([1]);
    // Un restaurante que dejó de ser de esa empresa deja de entrar.
    expect(
      resolveRestaurantIds(
        grants({ empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: selected([1, 2]) }),
        restaurants.map((r) => (r.id === 2 ? { ...r, empresaId: 2 } : r))
      )
    ).toEqual([1]);
  });

  it("una asignación sin su empresa se ignora", () => {
    expect(resolveRestaurantIds(grants({ restaurantes: selected([1, 2]) }), restaurants)).toEqual([]);
  });

  it("resultado ordenado y sin duplicados", () => {
    expect(
      resolveRestaurantIds(
        grants({
          empresas: [{ empresaId: 1, todosRestaurantes: false }],
          restaurantes: [...selected([5, 1]), ...selected([1])],
        }),
        restaurants
      )
    ).toEqual([1, 5]);
  });
});

describe("validateContactAccess", () => {
  it("selección de restaurantes de la empresa, ordenada y sin duplicados", () => {
    expect(validateContactAccess({ tipo: "supervisor", empresaId: 1, restaurantIds: [4, 1, 1] }, catalog)).toEqual({
      ok: true,
      value: { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 4] },
    });
  });

  it("un restaurante de otra empresa o inexistente se rechaza", () => {
    expect(validateContactAccess({ empresaId: 1, restaurantIds: [1, 6] }, catalog)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no son de la empresa"),
    });
    expect(validateContactAccess({ empresaId: 1, restaurantIds: [999] }, catalog).ok).toBe(false);
  });

  it("todos → no guarda lista de restaurantes", () => {
    expect(validateContactAccess({ empresaId: 1, todosRestaurantes: true, restaurantIds: [1, 2] }, catalog)).toEqual({
      ok: true,
      value: { tipo: null, empresaId: 1, todosRestaurantes: true, restaurantIds: [] },
    });
  });

  it("sin empresa → sin acceso (no se guardan restaurantes aunque lleguen)", () => {
    for (const empresaId of [undefined, null, ""]) {
      expect(validateContactAccess({ empresaId, todosRestaurantes: true, restaurantIds: [1] }, catalog)).toEqual({
        ok: true,
        value: { tipo: null, empresaId: null, todosRestaurantes: false, restaurantIds: [] },
      });
    }
  });

  it("empresa inexistente o con tipo incorrecto se rechaza", () => {
    for (const empresaId of [99, "1", 1.5, 0, true]) {
      expect(validateContactAccess({ empresaId }, catalog).ok).toBe(false);
    }
  });

  it("listas y banderas con tipos incorrectos se rechazan", () => {
    for (const restaurantIds of ["1", [1, "2"], [0], [-1], [1.5], {}]) {
      expect(validateContactAccess({ empresaId: 1, restaurantIds }, catalog).ok).toBe(false);
    }
    expect(validateContactAccess({ empresaId: 1, todosRestaurantes: "yes" }, catalog).ok).toBe(false);
  });

  it("el tipo es opcional y solo admite los conocidos; no condiciona los permisos", () => {
    expect(validateContactAccess({ empresaId: 1, restaurantIds: [1] }, catalog)).toMatchObject({ ok: true, value: { tipo: null } });
    expect(validateContactAccess({ tipo: "dios", empresaId: 1 }, catalog).ok).toBe(false);

    // Mismo contacto con distinto tipo: mismos permisos.
    const a = validateContactAccess({ tipo: "direccion", empresaId: 1, restaurantIds: [1, 2] }, catalog);
    const b = validateContactAccess({ tipo: "otro", empresaId: 1, restaurantIds: [1, 2] }, catalog);
    expect(a.ok && b.ok && a.value.restaurantIds).toEqual(b.ok && b.value.restaurantIds);
  });
});

describe("tipos de contacto", () => {
  it("son los seis pedidos, descriptivos", () => {
    expect(CONTACT_TYPES.map((type) => type.label)).toEqual([
      "Dirección",
      "Operaciones",
      "Supervisor",
      "Responsable de marca",
      "Responsable de restaurante",
      "Otro",
    ]);
    expect(isContactType("supervisor")).toBe(true);
    expect(isContactType("restaurante_user")).toBe(false);
    expect(contactTypeLabel("supervisor")).toBe("Supervisor");
    expect(contactTypeLabel(null)).toBeNull();
  });

  it("los roles web (restaurante_user…) no se mezclan con los tipos de contacto", () => {
    for (const rol of ["super_admin", "empresa_admin", "marca_admin", "restaurante_user"]) {
      expect(isContactType(rol)).toBe(false);
    }
  });
});

describe("función SQL nexo_set_contact_access (migración)", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/contact_access_management.sql"), "utf-8");

  it("deja exactamente la selección final y limpia lo de otra empresa, antes que su empresa (claves foráneas)", () => {
    expect(sql).toContain("restaurante_id <> all (v_restaurantes)");
    expect(sql).toContain("empresa_id <> p_empresa_id");
    expect(sql.indexOf("delete from public.conv_contacto_restaurantes")).toBeLessThan(
      sql.indexOf("delete from public.conv_contacto_empresas")
    );
  });

  it("valida en la base de datos que los restaurantes son de la empresa", () => {
    expect(sql).toContain("x.empresa_id = p_empresa_id");
    expect(sql).toContain("restaurante de otra empresa o inexistente");
  });

  it("con 'todos' no guarda restaurantes y usa el campo existente todos_restaurantes", () => {
    expect(sql).toContain("todos_restaurantes");
    expect(sql).toContain("if not v_todos then");
  });

  it("solo la service role la ejecuta y el tipo es una etiqueta con lista cerrada", () => {
    expect(sql).toContain("revoke all on function public.nexo_set_contact_access");
    expect(sql).toContain("to service_role");
    for (const id of CONTACT_TYPES.map((type) => type.id)) expect(sql).toContain(`'${id}'`);
  });
});
