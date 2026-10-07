import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

// Empresa 1 (Grupo): restaurantes 1-4 (marcas 10, 10, 20, 20). Empresa 2 (Otra): restaurante 5 (marca 30).
function seed() {
  return createFakeDb({
    empresas: [
      { id: 1, nombre: "Grupo" },
      { id: 2, nombre: "Otra" },
    ],
    marcas: [
      { id: 10, nombre: "Burger King" },
      { id: 20, nombre: "Popeyes" },
      { id: 30, nombre: "Vault" },
    ],
    restaurantes: [
      { id: 1, empresa_id: 1, marca_id: 10 },
      { id: 2, empresa_id: 1, marca_id: 10 },
      { id: 3, empresa_id: 1, marca_id: 20 },
      { id: 4, empresa_id: 1, marca_id: 20 },
      { id: 5, empresa_id: 2, marca_id: 30 },
    ],
    perfiles: [
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
      { id: "u-marta", nombre: "Marta", email: "m@x.test", rol: "marca_admin", empresa_id: 1 },
      { id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 },
      { id: "u-root", nombre: "Root", email: "r@x.test", rol: "super_admin", empresa_id: null },
    ],
    usuario_marcas: [{ user_id: "u-marta", marca_id: 10 }],
    usuario_restaurantes: [
      { user_id: "u-victor", restaurante_id: 1 },
      { user_id: "u-victor", restaurante_id: 2 },
      { user_id: "u-victor", restaurante_id: 3 },
    ],
    conv_contactos: [
      { id: "c-pilar", usuario_id: "u-pilar" },
      { id: "c-marta", usuario_id: "u-marta" },
      { id: "c-victor", usuario_id: "u-victor" },
      { id: "c-root", usuario_id: "u-root" },
      { id: "c-none", usuario_id: null },
      { id: "c-huerfano", usuario_id: "u-no-existe" },
    ],
  });
}

const { resolveContactDataScope, resolveContactRestaurantIds } = await import("@/lib/conversations/contact-scope.server");
const { fetchUserScope } = await import("@/lib/auth/scopes");
const { fetchPerfilFresh } = await import("@/lib/auth/perfiles");

beforeEach(() => {
  db = seed();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const setUsuarioId = (contactoId: string, usuarioId: string | null) => {
  db.tables.conv_contactos!.find((row) => row.id === contactoId)!.usuario_id = usuarioId;
};
const setRestaurants = (userId: string, ids: number[]) => {
  db.tables.usuario_restaurantes = [
    ...db.tables.usuario_restaurantes!.filter((row) => row.user_id !== userId),
    ...ids.map((id) => ({ user_id: userId, restaurante_id: id })),
  ];
};

describe("contacto sin acceso (deny by default)", () => {
  it("contacto sin usuario vinculado → alcance vacío", async () => {
    expect(await resolveContactRestaurantIds("c-none")).toEqual([]);
    expect(await resolveContactDataScope("c-none")).toMatchObject({ restauranteIds: [], marcaIds: [] });
  });

  it("contacto inexistente, usuario sin perfil o error de lectura → deny", async () => {
    expect(await resolveContactRestaurantIds("c-inventado")).toEqual([]);
    expect(await resolveContactRestaurantIds("c-huerfano")).toEqual([]);

    db.failures.conv_contactos = { code: "08006" };
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([]);
  });

  it("desvincular el contacto lo deja sin acceso inmediatamente", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3]);
    setUsuarioId("c-victor", null);
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([]);
  });
});

describe("el contacto tiene el alcance de su usuario de Nexo", () => {
  it("empresa_admin → todos los restaurantes de su empresa (y ninguno de otra)", async () => {
    expect(await resolveContactRestaurantIds("c-pilar")).toEqual([1, 2, 3, 4]);
  });

  it("un restaurante nuevo de la empresa entra solo, sin tocar asignaciones", async () => {
    db.tables.restaurantes!.push({ id: 6, empresa_id: 1, marca_id: 20 });
    expect(await resolveContactRestaurantIds("c-pilar")).toEqual([1, 2, 3, 4, 6]);
    expect(db.tables.usuario_restaurantes!.filter((row) => row.user_id === "u-pilar")).toHaveLength(0);
  });

  it("marca_admin → restaurantes de sus marcas, y un restaurante nuevo de esa marca entra solo", async () => {
    expect(await resolveContactRestaurantIds("c-marta")).toEqual([1, 2]);
    db.tables.restaurantes!.push({ id: 7, empresa_id: 1, marca_id: 10 });
    db.tables.restaurantes!.push({ id: 8, empresa_id: 1, marca_id: 20 });
    expect(await resolveContactRestaurantIds("c-marta")).toEqual([1, 2, 7]);
  });

  it("restaurante_user → exactamente los de usuario_restaurantes (varios)", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3]);
  });

  it("cambiar la selección cambia el alcance al instante: Zizur, Tudela, Calahorra → Zizur, Utebo", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3]);
    setRestaurants("u-victor", [1, 4]);
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 4]);
  });

  it("quitar un restaurante elimina el acceso y añadirlo lo concede", async () => {
    setRestaurants("u-victor", [1, 2]);
    expect(await resolveContactRestaurantIds("c-victor")).not.toContain(3);
    setRestaurants("u-victor", [1, 2, 3, 4]);
    expect(await resolveContactRestaurantIds("c-victor")).toContain(4);
  });

  it("super_admin vinculado → todos los restaurantes existentes", async () => {
    expect(await resolveContactRestaurantIds("c-root")).toEqual([1, 2, 3, 4, 5]);
  });

  it("el cambio de rol se aplica de inmediato (perfil sin caché)", async () => {
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3]);
    db.tables.perfiles!.find((row) => row.id === "u-victor")!.rol = "empresa_admin";
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3, 4]);
  });

  it("restos de asignaciones de otro rol no amplían ni cambian el acceso", async () => {
    // Una marca_admin con filas sobrantes en usuario_restaurantes: solo cuentan sus marcas.
    db.tables.usuario_restaurantes!.push({ user_id: "u-marta", restaurante_id: 4 });
    expect(await resolveContactRestaurantIds("c-marta")).toEqual([1, 2]);

    // Un empresa_admin con filas sobrantes de marcas y restaurantes: sigue siendo su empresa.
    db.tables.usuario_marcas!.push({ user_id: "u-pilar", marca_id: 30 });
    db.tables.usuario_restaurantes!.push({ user_id: "u-pilar", restaurante_id: 5 });
    expect(await resolveContactRestaurantIds("c-pilar")).toEqual([1, 2, 3, 4]);

    // Un supervisor con filas sobrantes de marcas: sigue siendo solo lo asignado.
    db.tables.usuario_marcas!.push({ user_id: "u-victor", marca_id: 20 });
    expect(await resolveContactRestaurantIds("c-victor")).toEqual([1, 2, 3]);
  });

  it("nunca incluye restaurantes de otra empresa aunque estén asignados por error en el rol amplio", async () => {
    expect(await resolveContactRestaurantIds("c-pilar")).not.toContain(5);
    expect(await resolveContactRestaurantIds("c-marta")).not.toContain(5);
  });
});

describe("misma lógica que la web", () => {
  it("el alcance del contacto es el de fetchUserScope del mismo usuario (forzado, aunque la web no filtre)", async () => {
    for (const [contactoId, userId] of [
      ["c-pilar", "u-pilar"],
      ["c-marta", "u-marta"],
      ["c-victor", "u-victor"],
    ] as const) {
      const perfil = (await fetchPerfilFresh(userId))!;
      const web = await fetchUserScope(userId, perfil, { enforceScoping: true });
      expect(await resolveContactDataScope(contactoId)).toEqual(web);
    }
  });

  it("con el filtrado de la web activado, scope web y scope del contacto coinciden para el mismo usuario", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SCOPING_ENABLED", "true");
    vi.resetModules();
    const scopes = await import("@/lib/auth/scopes");
    const contact = await import("@/lib/conversations/contact-scope.server");
    const perfiles = await import("@/lib/auth/perfiles");

    for (const [contactoId, userId] of [
      ["c-pilar", "u-pilar"],
      ["c-marta", "u-marta"],
      ["c-victor", "u-victor"],
    ] as const) {
      const perfil = (await perfiles.fetchPerfilFresh(userId))!;
      expect(await contact.resolveContactDataScope(contactoId)).toEqual(await scopes.fetchUserScope(userId, perfil));
    }
  });

  it("el filtrado forzado evita que un contacto lo vea todo cuando la web no filtra", async () => {
    // Sin la variable, la web devuelve "sin restricción" para un supervisor…
    const perfil = (await fetchPerfilFresh("u-victor"))!;
    expect((await fetchUserScope("u-victor", perfil)).restauranteIds).toBeNull();
    // …pero el contacto solo ve lo suyo.
    expect((await resolveContactDataScope("c-victor")).restauranteIds).toEqual([1, 2, 3]);
  });

  it("no se duplica la lógica de permisos: el resolvedor delega en fetchUserScope", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/conversations/contact-scope.server.ts"), "utf-8");
    expect(source).toContain("fetchUserScope(");
    expect(source).toContain("enforceScoping: true");
    for (const role of ["empresa_admin", "marca_admin", "restaurante_user", "usuario_restaurantes", "usuario_marcas"]) {
      expect(source, role).not.toContain(role);
    }
  });
});
