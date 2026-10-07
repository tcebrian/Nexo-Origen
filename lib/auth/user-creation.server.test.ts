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
      { id: "u-root", nombre: "Root", email: "root@x.test", rol: "super_admin", empresa_id: null },
      { id: "u-victor", nombre: "Víctor", email: "victor@x.test", rol: "restaurante_user", empresa_id: 1 },
    ],
    usuario_marcas: [],
    usuario_restaurantes: [],
  });
}

const { createActivationLink, createManagedUser } = await import("@/lib/auth/user-creation.server");

const admin = { userId: "u-root", rol: "super_admin" };
const ORIGIN = "https://nexo.example";
const supervisor = {
  nombre: "Lidia",
  email: "Lidia@Example.com",
  empresaId: 1,
  tipo: "supervisor",
  restaurantIds: [1, 3],
};

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error as { status: number; message: string }
  );
}

beforeEach(() => {
  db = seed();
});

describe("createManagedUser", () => {
  it("crea la cuenta sin contraseña, confirmada, y después el perfil y el acceso en una sola función SQL", async () => {
    const created = await createManagedUser(admin, supervisor, ORIGIN);

    // 1) Supabase Auth con la service role: email normalizado y SIN contraseña.
    expect(db.auth.created).toEqual([{ email: "lidia@example.com", email_confirm: true, user_metadata: { nombre: "Lidia" } }]);
    expect(JSON.stringify(db.auth.created)).not.toMatch(/password/i);

    // 2) Perfil con el mismo id que la cuenta, rol técnico y empresa.
    expect(db.tables.perfiles!.find((p) => p.id === created.userId)).toMatchObject({
      nombre: "Lidia",
      email: "lidia@example.com",
      rol: "restaurante_user",
      empresa_id: 1,
    });

    // 3) Asignaciones con la función transaccional de siempre.
    expect(db.rpcCalls).toEqual([
      {
        fn: "nexo_set_user_access",
        args: { p_user_id: created.userId, p_rol: "restaurante_user", p_empresa_id: 1, p_restaurante_ids: [1, 3], p_marca_ids: [] },
      },
    ]);
  });

  it("supervisor: puede mezclar marcas (restaurantes de BK y de Popeyes)", async () => {
    await createManagedUser(admin, { ...supervisor, restaurantIds: [4, 1, 3] }, ORIGIN);
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_restaurante_ids: [1, 3, 4] });
  });

  it("responsable de marca: guarda marcas y ningún restaurante", async () => {
    await createManagedUser(admin, { ...supervisor, tipo: "marca", marcaIds: [20, 10], restaurantIds: [1, 2] }, ORIGIN);
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_rol: "marca_admin", p_marca_ids: [10, 20], p_restaurante_ids: [] });
  });

  it("administrador de empresa: solo la empresa, sin asignaciones", async () => {
    await createManagedUser(admin, { ...supervisor, tipo: "empresa", restaurantIds: [1], marcaIds: [10] }, ORIGIN);
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_rol: "empresa_admin", p_restaurante_ids: [], p_marca_ids: [] });
  });

  it("solo un super_admin puede crear usuarios", async () => {
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      expect(await failure(createManagedUser({ userId: "u-victor", rol }, supervisor, ORIGIN))).toMatchObject({ status: 403 });
    }
    expect(db.auth.created).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("valida todo ANTES de crear nada: restaurante de otra empresa, tipo o email inválidos → 400 sin cuenta", async () => {
    expect(await failure(createManagedUser(admin, { ...supervisor, restaurantIds: [1, 5] }, ORIGIN))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, tipo: "super_admin" }, ORIGIN))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, email: "no-es-email" }, ORIGIN))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, tipo: "marca", marcaIds: [30] }, ORIGIN))).toMatchObject({ status: 400 });
    expect(db.auth.created).toHaveLength(0);
    expect(db.tables.perfiles).toHaveLength(2);
  });

  it("un email duplicado se rechaza (409), aunque cambie la capitalización, y no se crea nada", async () => {
    expect(await failure(createManagedUser(admin, { ...supervisor, email: "VICTOR@x.test" }, ORIGIN))).toMatchObject({ status: 409 });
    expect(db.auth.created).toHaveLength(0);

    // También si Auth lo detecta (cuenta sin perfil).
    db.auth.users.push({ id: "auth-x", email: "lidia@example.com" });
    const error = await failure(createManagedUser(admin, supervisor, ORIGIN));
    expect(error).toMatchObject({ status: 409 });
    expect(db.tables.perfiles).toHaveLength(2);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("si falla el acceso, la cuenta recién creada se elimina (no quedan usuarios a medias)", async () => {
    db.rpcResult = { error: { code: "08006" } };
    const error = await failure(createManagedUser(admin, supervisor, ORIGIN));

    expect(error).toMatchObject({ status: 500 });
    expect(db.auth.deleted).toHaveLength(1);
    expect(db.auth.users).toHaveLength(0);
    expect(db.tables.perfiles).toHaveLength(2); // el perfil nuevo cayó con la cuenta
    expect(db.tables.perfiles!.some((p) => p.email === "lidia@example.com")).toBe(false);
  });

  it("una selección rechazada por la base de datos (22023) → 400 y también se deshace", async () => {
    db.rpcResult = { error: { code: "22023" } };
    expect(await failure(createManagedUser(admin, supervisor, ORIGIN))).toMatchObject({ status: 400 });
    expect(db.auth.users).toHaveLength(0);
  });

  it("si falla la creación del perfil, se elimina la cuenta y no se llama a la función de acceso", async () => {
    db.failures.perfiles = { code: "23505", message: "duplicate key lidia@example.com" };
    // La comprobación previa también lee `perfiles`: se simula un fallo solo en la inserción.
    const original = db.client.from;
    db.client.from = (table: string) => {
      const builder = original(table) as { insert: (values: unknown) => unknown };
      if (table === "perfiles") {
        delete db.failures.perfiles;
        const insert = builder.insert;
        builder.insert = (values: unknown) => {
          db.failures.perfiles = { code: "23505", message: "duplicate key lidia@example.com" };
          return insert.call(builder, values);
        };
      }
      return builder;
    };
    const error = await failure(createManagedUser(admin, supervisor, ORIGIN));
    expect(error).toMatchObject({ status: 500 });
    expect((error as Error).message).not.toContain("lidia");
    expect(db.auth.deleted).toHaveLength(1);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("devuelve un enlace de un solo uso hacia /auth/confirm con el token hash, nunca una contraseña", async () => {
    const created = await createManagedUser(admin, supervisor, ORIGIN);

    expect(created.activationUrl).toBe(`${ORIGIN}/auth/confirm?token_hash=HASHED-1&type=recovery`);
    expect(db.auth.links).toEqual([{ type: "recovery", email: "lidia@example.com" }]);
    expect(JSON.stringify(created)).not.toMatch(/password|contrase/i);
  });

  it("si el enlace no se puede generar, el usuario queda creado y se podrá regenerar", async () => {
    db.auth.linkError = { code: "unexpected_failure" };
    const created = await createManagedUser(admin, supervisor, ORIGIN);
    expect(created.activationUrl).toBeNull();
    expect(db.auth.users).toHaveLength(1);
    expect(db.auth.deleted).toHaveLength(0);
  });

  it("un error de Supabase Auth no se copia al cliente", async () => {
    db.auth.createError = { code: "unexpected_failure", status: 500 };
    const error = await failure(createManagedUser(admin, supervisor, ORIGIN));
    expect(error).toMatchObject({ status: 500, message: "No se pudo crear el usuario" });
  });
});

describe("createActivationLink", () => {
  it("genera un enlace nuevo para un usuario existente", async () => {
    const url = await createActivationLink(admin, "u-victor", ORIGIN);
    expect(url).toBe(`${ORIGIN}/auth/confirm?token_hash=HASHED-1&type=recovery`);
    expect(db.auth.links[0]).toEqual({ type: "recovery", email: "victor@x.test" });
  });

  it("solo super_admin, nunca el propio ni el de otro super_admin", async () => {
    expect(await failure(createActivationLink({ userId: "u-victor", rol: "restaurante_user" }, "u-victor", ORIGIN))).toMatchObject({ status: 403 });
    expect(await failure(createActivationLink(admin, "u-root", ORIGIN))).toMatchObject({ status: 403 });
    expect(await failure(createActivationLink(admin, "u-nadie", ORIGIN))).toMatchObject({ status: 404 });
    expect(db.auth.links).toHaveLength(0);
  });
});
