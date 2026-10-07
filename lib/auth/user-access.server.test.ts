import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

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
      { id: 1, nombre: "Zizur", ciudad: "Zizur", empresa_id: 1, marca_id: 10, activo: true },
      { id: 2, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 10, activo: true },
      { id: 3, nombre: "Calahorra", ciudad: "Calahorra", empresa_id: 1, marca_id: 20, activo: true },
      { id: 4, nombre: "Utebo", ciudad: "Utebo", empresa_id: 1, marca_id: 20, activo: true },
      { id: 5, nombre: "Vault 1", ciudad: "Madrid", empresa_id: 2, marca_id: 30, activo: true },
    ],
    perfiles: [
      { id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 },
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
      { id: "u-root", nombre: "Root", email: "r@x.test", rol: "super_admin", empresa_id: null },
    ],
    usuario_marcas: [],
    usuario_restaurantes: [
      { user_id: "u-victor", restaurante_id: 1 },
      { user_id: "u-victor", restaurante_id: 2 },
      { user_id: "u-victor", restaurante_id: 3 },
    ],
  });
}

const { UserAccessError, getManagedUserDetail, listManagedUsers, setManagedUserAccess } = await import(
  "@/lib/auth/user-access.server"
);

const admin = { userId: "u-root", rol: "super_admin" };
const selection = { rol: "restaurante_user", empresaId: 1, restaurantIds: [1, 4], marcaIds: [] };

beforeEach(() => {
  db = seed();
});

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error as InstanceType<typeof UserAccessError>
  );
}

describe("setManagedUserAccess", () => {
  it("envía a la función SQL EXACTAMENTE la selección final (no la suma con la anterior)", async () => {
    // Antes: Zizur, Tudela, Calahorra (1, 2, 3). Después: Zizur, Utebo (1, 4).
    await setManagedUserAccess(admin, "u-victor", selection);

    expect(db.rpcCalls).toEqual([
      {
        fn: "nexo_set_user_access",
        args: {
          p_user_id: "u-victor",
          p_rol: "restaurante_user",
          p_empresa_id: 1,
          p_restaurante_ids: [1, 4],
          p_marca_ids: [],
        },
      },
    ]);
  });

  it("solo un super_admin gestiona permisos; el resto recibe 403 y no se toca nada", async () => {
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      const error = await failure(setManagedUserAccess({ userId: "u-pilar", rol }, "u-victor", selection));
      expect(error).toMatchObject({ status: 403 });
    }
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("un supervisor no puede editar sus propios permisos", async () => {
    const error = await failure(
      setManagedUserAccess({ userId: "u-victor", rol: "restaurante_user" }, "u-victor", { ...selection, restaurantIds: [1, 2, 3, 4] })
    );
    expect(error).toMatchObject({ status: 403 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("no se gestiona a un super_admin ni se crea uno", async () => {
    expect(await failure(setManagedUserAccess(admin, "u-root", selection))).toMatchObject({ status: 403 });
    expect(await failure(setManagedUserAccess(admin, "u-victor", { ...selection, rol: "super_admin" }))).toMatchObject({ status: 400 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("usuario inexistente → 404", async () => {
    expect(await failure(setManagedUserAccess(admin, "u-nadie", selection))).toMatchObject({ status: 404 });
  });

  it("un restaurante de otra empresa se rechaza en servidor antes de llegar a la base de datos", async () => {
    const error = await failure(setManagedUserAccess(admin, "u-victor", { ...selection, restaurantIds: [1, 5] }));
    expect(error).toMatchObject({ status: 400 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("al cambiar de rol solo viaja lo que el rol nuevo usa", async () => {
    await setManagedUserAccess(admin, "u-victor", { rol: "marca_admin", empresaId: 1, restaurantIds: [1, 2, 3], marcaIds: [10] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_rol: "marca_admin", p_restaurante_ids: [], p_marca_ids: [10] });

    await setManagedUserAccess(admin, "u-victor", { rol: "empresa_admin", empresaId: 1, restaurantIds: [1], marcaIds: [10] });
    expect(db.rpcCalls[1]!.args).toMatchObject({ p_rol: "empresa_admin", p_restaurante_ids: [], p_marca_ids: [] });

    await setManagedUserAccess(admin, "u-pilar", { rol: "restaurante_user", empresaId: 1, restaurantIds: [2], marcaIds: [20] });
    expect(db.rpcCalls[2]!.args).toMatchObject({ p_rol: "restaurante_user", p_restaurante_ids: [2], p_marca_ids: [] });
  });

  it("los errores de la función SQL se traducen sin copiar el mensaje de la base de datos", async () => {
    const cases: [string, number][] = [
      ["22023", 400],
      ["42501", 403],
      ["P0002", 404],
      ["08006", 500],
    ];
    for (const [code, status] of cases) {
      db.rpcResult = { error: { code } };
      const error = await failure(setManagedUserAccess(admin, "u-victor", selection));
      expect(error).toBeInstanceOf(UserAccessError);
      expect(error).toMatchObject({ status });
      expect((error as Error).message).not.toMatch(/wamid|u-victor|23505|duplicate/i);
    }
  });
});

describe("acceso efectivo mostrado (misma lógica que la web)", () => {
  it("el detalle y el listado cuentan lo que fetchUserScope devuelve hoy", async () => {
    expect((await getManagedUserDetail("u-victor"))!.effective.count).toBe(3);
    expect((await getManagedUserDetail("u-pilar"))!.effective.count).toBe(4);

    // La asignación cambia → el recuento cambia sin ningún otro paso.
    db.tables.usuario_restaurantes = [
      { user_id: "u-victor", restaurante_id: 1 },
      { user_id: "u-victor", restaurante_id: 4 },
    ];
    const detail = (await getManagedUserDetail("u-victor"))!;
    expect(detail.effective.restaurants.map((r) => r.name)).toEqual(["Zizur", "Utebo"]);
    expect(detail.selection.restaurantIds.sort()).toEqual([1, 4]);

    const list = await listManagedUsers();
    expect(list.find((u) => u.id === "u-victor")!.restaurantCount).toBe(2);
    expect(list.find((u) => u.id === "u-root")!.restaurantCount).toBe(5);
  });

  it("usuario inexistente → null", async () => {
    expect(await getManagedUserDetail("u-nadie")).toBeNull();
  });

  it("las opciones del formulario incluyen empresas, marcas con su empresa y restaurantes con su empresa", async () => {
    const { options } = (await getManagedUserDetail("u-victor"))!;
    expect(options.empresas.map((e) => e.id)).toEqual([1, 2]);
    expect(options.marcas.find((m) => m.id === 10)!.empresaIds).toEqual([1]);
    expect(options.restaurants.find((r) => r.id === 5)).toMatchObject({ empresaId: 2, marcaId: 30 });
  });
});
