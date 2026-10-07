import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

// Empresa 1 (Grupo): BK Zizur 1, BK Tudela 2, BK Soria 3, Popeyes Tudela 4, Popeyes Logroño 5. Empresa 2: Vault 6.
function seed() {
  return createFakeDb({
    restaurantes: [
      { id: 1, empresa_id: 1, marca_id: 10 },
      { id: 2, empresa_id: 1, marca_id: 10 },
      { id: 3, empresa_id: 1, marca_id: 10 },
      { id: 4, empresa_id: 1, marca_id: 20 },
      { id: 5, empresa_id: 1, marca_id: 20 },
      { id: 6, empresa_id: 2, marca_id: 30 },
    ],
    // Cuentas web con roles amplios: NO deben influir en el alcance de WhatsApp.
    perfiles: [
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
      { id: "u-bk-soria", nombre: "Burger King Soria", email: "soria@x.test", rol: "restaurante_user", empresa_id: 1 },
    ],
    usuario_restaurantes: [{ user_id: "u-bk-soria", restaurante_id: 3 }],
    usuario_marcas: [],
    conv_contactos: [
      { id: "c-victor", usuario_id: null },
      { id: "c-todos", usuario_id: null },
      { id: "c-nada", usuario_id: null },
      { id: "c-desconocido", usuario_id: null },
      { id: "c-vinculado", usuario_id: "u-pilar" },
    ],
    conv_contacto_empresas: [
      { contacto_id: "c-victor", empresa_id: 1, todos_restaurantes: false },
      { contacto_id: "c-todos", empresa_id: 1, todos_restaurantes: true },
      { contacto_id: "c-vinculado", empresa_id: 1, todos_restaurantes: false },
    ],
    conv_contacto_restaurantes: [
      // Víctor: BK Zizur, BK Tudela y Popeyes Tudela.
      { contacto_id: "c-victor", empresa_id: 1, restaurante_id: 1 },
      { contacto_id: "c-victor", empresa_id: 1, restaurante_id: 2 },
      { contacto_id: "c-victor", empresa_id: 1, restaurante_id: 4 },
      { contacto_id: "c-vinculado", empresa_id: 1, restaurante_id: 5 },
    ],
  });
}

const { getContactAccessSelection, resolveContactRestaurantIds, resolveContactsRestaurantIds } = await import(
  "@/lib/conversations/contact-scope.server"
);

beforeEach(() => {
  db = seed();
});

const setSelection = (contactId: string, ids: number[]) => {
  db.tables.conv_contacto_restaurantes = [
    ...db.tables.conv_contacto_restaurantes!.filter((row) => row.contacto_id !== contactId),
    ...ids.map((restaurante_id) => ({ contacto_id: contactId, empresa_id: 1, restaurante_id })),
  ];
};

describe("resolveContactRestaurantIds", () => {
  it("contacto sin permisos → []", async () => {
    expect(await resolveContactRestaurantIds("c-nada")).toEqual([]);
  });

  it("contacto con 3 restaurantes → exactamente esos 3, mezclando marcas (BK + Popeyes)", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
  });

  it("BK Soria no entra (informe diario o alerta negativa de Soria no es para Víctor)", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).not.toContain(3);
  });

  it("todos_restaurantes → todos los restaurantes de la empresa y ninguno de otra", async () => {
    expect(await resolveContactRestaurantIds("c-todos")).toEqual([1, 2, 3, 4, 5]);
  });

  it("un restaurante nuevo entra automáticamente con todos=true…", async () => {
    db.tables.restaurantes!.push({ id: 7, empresa_id: 1, marca_id: 10 });
    expect(await resolveContactRestaurantIds("c-todos")).toContain(7);
  });

  it("…y NO entra con una selección explícita", async () => {
    db.tables.restaurantes!.push({ id: 7, empresa_id: 1, marca_id: 10 });
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
  });

  it("un restaurante de otra empresa no cuenta aunque hubiera una fila (integridad defensiva)", async () => {
    db.tables.conv_contacto_restaurantes!.push({ contacto_id: "c-victor", empresa_id: 1, restaurante_id: 6 });
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
  });

  it("cambiar la selección sustituye la anterior: Zizur, Tudela, Calahorra → Zizur, Utebo", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
    setSelection("c-victor", [1, 5]);
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 5]);
  });

  it("pasar a 'todos' y volver a una selección se refleja al instante", async () => {
    db.tables.conv_contacto_empresas!.find((row) => row.contacto_id === "c-victor")!.todos_restaurantes = true;
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3, 4, 5]);
    db.tables.conv_contacto_empresas!.find((row) => row.contacto_id === "c-victor")!.todos_restaurantes = false;
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
  });

  it("un desconocido que escribe sigue sin acceso", async () => {
    expect(await resolveContactRestaurantIds("c-desconocido")).toEqual([]);
    expect(await resolveContactRestaurantIds("c-que-no-existe")).toEqual([]);
  });

  it("cualquier error de lectura → sin acceso (deny)", async () => {
    for (const table of ["conv_contacto_empresas", "conv_contacto_restaurantes", "restaurantes"]) {
      db = seed();
      db.failures[table] = { code: "08006" };
      expect(await resolveContactRestaurantIds("c-victor")).toEqual([]);
    }
  });
});

describe("la cuenta web (usuario_id) es opcional e independiente", () => {
  it("usuario_id nulo NO impide tener permisos de WhatsApp", async () => {
    expect(db.tables.conv_contactos!.find((c) => c.id === "c-victor")!.usuario_id).toBeNull();
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 4]);
  });

  it("usuario_id vinculado NO cambia el alcance de WhatsApp: ni lo amplía (empresa_admin) ni lo copia", async () => {
    // c-vinculado está vinculado a Pilar (empresa_admin: toda la empresa en la web)…
    expect(await resolveContactRestaurantIds("c-vinculado")).toEqual([5]);
    // …y desvincularlo no le quita ni le da nada.
    db.tables.conv_contactos!.find((c) => c.id === "c-vinculado")!.usuario_id = null;
    expect(await resolveContactRestaurantIds("c-vinculado")).toEqual([5]);
  });

  it("vincular una cuenta a un contacto sin permisos no le da acceso", async () => {
    db.tables.conv_contactos!.find((c) => c.id === "c-nada")!.usuario_id = "u-pilar";
    expect(await resolveContactRestaurantIds("c-nada")).toEqual([]);
  });

  it("cambiar los permisos de la cuenta web no toca los del contacto", async () => {
    db.tables.perfiles!.find((p) => p.id === "u-pilar")!.rol = "restaurante_user";
    db.tables.usuario_restaurantes!.push({ user_id: "u-pilar", restaurante_id: 1 });
    expect(await resolveContactRestaurantIds("c-vinculado")).toEqual([5]);
  });

  it("el resolvedor no usa fetchUserScope, perfiles ni usuario_id", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/conversations/contact-scope.server.ts"), "utf-8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["fetchUserScope", "fetchPerfil", "usuario_id", "usuario_restaurantes", "usuario_marcas", "perfiles"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });
});

describe("resolveContactsRestaurantIds (listados)", () => {
  it("resuelve varios contactos en una pasada, incluido el sin acceso", async () => {
    const map = await resolveContactsRestaurantIds(["c-victor", "c-todos", "c-nada", "c-desconocido"]);
    expect(map.get("c-victor")).toEqual([1, 2, 4]);
    expect(map.get("c-todos")).toEqual([1, 2, 3, 4, 5]);
    expect(map.get("c-nada")).toEqual([]);
    expect(map.get("c-desconocido")).toEqual([]);
  });
});

describe("getContactAccessSelection (lo guardado, para editar)", () => {
  it("empresa, 'todos' y selección explícita", async () => {
    expect(await getContactAccessSelection("c-victor")).toEqual({ empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2, 4] });
    expect(await getContactAccessSelection("c-todos")).toEqual({ empresaId: 1, todosRestaurantes: true, restaurantIds: [] });
    expect(await getContactAccessSelection("c-nada")).toEqual({ empresaId: null, todosRestaurantes: false, restaurantIds: [] });
  });
});
