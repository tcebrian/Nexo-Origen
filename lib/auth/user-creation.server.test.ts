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

const { changeOwnPassword, createManagedUser, setManagedUserPassword } = await import("@/lib/auth/user-creation.server");

const admin = { userId: "u-root", rol: "super_admin" };
const PASSWORD = "inicial-12345";
const supervisor = {
  nombre: "Lidia",
  email: "Lidia@Example.com",
  password: PASSWORD,
  empresaId: 1,
  tipo: "restaurantes",
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
  it("crea la cuenta con la contraseña inicial SOLO en Auth, y después el perfil y el acceso", async () => {
    const created = await createManagedUser(admin, supervisor);

    expect(db.auth.created).toEqual([
      { email: "lidia@example.com", password: PASSWORD, email_confirm: true, user_metadata: { nombre: "Lidia" } },
    ]);

    const perfil = db.tables.perfiles!.find((p) => p.id === created.userId);
    expect(perfil).toMatchObject({ nombre: "Lidia", email: "lidia@example.com", rol: "restaurante_user", empresa_id: 1, must_change_password: true });

    // La contraseña no aparece en ninguna tabla, ni en la RPC, ni en la respuesta, ni en los metadatos.
    expect(JSON.stringify(db.tables)).not.toContain(PASSWORD);
    expect(JSON.stringify(db.rpcCalls)).not.toContain(PASSWORD);
    expect(JSON.stringify(created)).not.toContain(PASSWORD);
    expect(JSON.stringify(db.auth.created[0]!.user_metadata)).not.toContain(PASSWORD);

    expect(db.rpcCalls).toEqual([
      {
        fn: "nexo_set_user_access",
        args: { p_user_id: created.userId, p_rol: "restaurante_user", p_empresa_id: 1, p_restaurante_ids: [1, 3], p_marca_ids: [] },
      },
    ]);
  });

  it("sin obligar al cambio, el perfil queda con must_change_password=false", async () => {
    const created = await createManagedUser(admin, { ...supervisor, mustChangePassword: false });
    expect(db.tables.perfiles!.find((p) => p.id === created.userId)).toMatchObject({ must_change_password: false });
  });

  it("contraseña inválida → 400 sin crear nada; weak_password de Auth → 400 genérico", async () => {
    expect(await failure(createManagedUser(admin, { ...supervisor, password: "corta" }))).toMatchObject({ status: 400 });
    expect(db.auth.created).toHaveLength(0);

    db.auth.createError = { code: "weak_password", status: 422 };
    expect(await failure(createManagedUser(admin, supervisor))).toMatchObject({ status: 400 });
    expect(db.tables.perfiles).toHaveLength(2);
  });

  it("supervisor: puede mezclar marcas (restaurantes de BK y de Popeyes)", async () => {
    await createManagedUser(admin, { ...supervisor, restaurantIds: [4, 1, 3] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_restaurante_ids: [1, 3, 4] });
  });

  it("responsable de marca: guarda marcas y ningún restaurante", async () => {
    await createManagedUser(admin, { ...supervisor, tipo: "marca", marcaIds: [20, 10], restaurantIds: [1, 2] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_rol: "marca_admin", p_marca_ids: [10, 20], p_restaurante_ids: [] });
  });

  it("administrador de empresa: solo la empresa, sin asignaciones", async () => {
    await createManagedUser(admin, { ...supervisor, tipo: "empresa", restaurantIds: [1], marcaIds: [10] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_rol: "empresa_admin", p_restaurante_ids: [], p_marca_ids: [] });
  });

  it("solo un super_admin puede crear usuarios", async () => {
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      expect(await failure(createManagedUser({ userId: "u-victor", rol }, supervisor))).toMatchObject({ status: 403 });
    }
    expect(db.auth.created).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("valida todo ANTES de crear nada: restaurante de otra empresa, tipo o email inválidos → 400 sin cuenta", async () => {
    expect(await failure(createManagedUser(admin, { ...supervisor, restaurantIds: [1, 5] }))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, tipo: "super_admin" }))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, email: "no-es-email" }))).toMatchObject({ status: 400 });
    expect(await failure(createManagedUser(admin, { ...supervisor, tipo: "marca", marcaIds: [30] }))).toMatchObject({ status: 400 });
    expect(db.auth.created).toHaveLength(0);
    expect(db.tables.perfiles).toHaveLength(2);
  });

  it("un email duplicado se rechaza (409), aunque cambie la capitalización, y no se crea nada", async () => {
    expect(await failure(createManagedUser(admin, { ...supervisor, email: "VICTOR@x.test" }))).toMatchObject({ status: 409 });
    expect(db.auth.created).toHaveLength(0);

    // También si Auth lo detecta (cuenta sin perfil).
    db.auth.users.push({ id: "auth-x", email: "lidia@example.com" });
    const error = await failure(createManagedUser(admin, supervisor));
    expect(error).toMatchObject({ status: 409 });
    expect(db.tables.perfiles).toHaveLength(2);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("si falla el acceso, la cuenta recién creada se elimina (no quedan usuarios a medias)", async () => {
    db.rpcResult = { error: { code: "08006" } };
    const error = await failure(createManagedUser(admin, supervisor));

    expect(error).toMatchObject({ status: 500 });
    expect(db.auth.deleted).toHaveLength(1);
    expect(db.auth.users).toHaveLength(0);
    expect(db.tables.perfiles).toHaveLength(2); // el perfil nuevo cayó con la cuenta
    expect(db.tables.perfiles!.some((p) => p.email === "lidia@example.com")).toBe(false);
  });

  it("una selección rechazada por la base de datos (22023) → 400 y también se deshace", async () => {
    db.rpcResult = { error: { code: "22023" } };
    expect(await failure(createManagedUser(admin, supervisor))).toMatchObject({ status: 400 });
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
    const error = await failure(createManagedUser(admin, supervisor));
    expect(error).toMatchObject({ status: 500 });
    expect((error as Error).message).not.toContain("lidia");
    expect(db.auth.deleted).toHaveLength(1);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("un error de Supabase Auth no se copia al cliente", async () => {
    db.auth.createError = { code: "unexpected_failure", status: 500 };
    const error = await failure(createManagedUser(admin, supervisor));
    expect(error).toMatchObject({ status: 500, message: "No se pudo crear el usuario" });
  });
});

describe("setManagedUserPassword", () => {
  it("el super_admin fija una contraseña nueva y por defecto obliga a cambiarla", async () => {
    await setManagedUserPassword(admin, "u-victor", { password: "otra-clave-123" });
    expect(db.auth.updated).toEqual([{ id: "u-victor", attrs: { password: "otra-clave-123" } }]);
    expect(db.tables.perfiles!.find((p) => p.id === "u-victor")).toMatchObject({ must_change_password: true });
    expect(JSON.stringify(db.tables)).not.toContain("otra-clave-123");

    await setManagedUserPassword(admin, "u-victor", { password: "otra-clave-123", mustChangePassword: false });
    expect(db.tables.perfiles!.find((p) => p.id === "u-victor")).toMatchObject({ must_change_password: false });
  });

  it("solo super_admin; nunca la propia cuenta ni la de otro super_admin; usuario inexistente → 404", async () => {
    const input = { password: "otra-clave-123" };
    expect(await failure(setManagedUserPassword({ userId: "u-victor", rol: "restaurante_user" }, "u-victor", input))).toMatchObject({ status: 403 });
    expect(await failure(setManagedUserPassword(admin, "u-root", input))).toMatchObject({ status: 403 });
    expect(await failure(setManagedUserPassword(admin, "u-nadie", input))).toMatchObject({ status: 404 });
    expect(db.auth.updated).toHaveLength(0);
  });

  it("contraseña inválida → 400 y no toca Auth; rechazo 422 de Auth → 400 genérico", async () => {
    expect(await failure(setManagedUserPassword(admin, "u-victor", { password: "corta" }))).toMatchObject({ status: 400 });
    expect(await failure(setManagedUserPassword(admin, "u-victor", { password: "otra-clave-123", mustChangePassword: "si" }))).toMatchObject({ status: 400 });
    expect(db.auth.updated).toHaveLength(0);

    db.auth.updateError = { status: 422, code: "weak_password" };
    expect(await failure(setManagedUserPassword(admin, "u-victor", { password: "otra-clave-123" }))).toMatchObject({ status: 400 });
  });
});

describe("changeOwnPassword", () => {
  it("guarda la contraseña en Auth y solo entonces baja must_change_password", async () => {
    db.tables.perfiles!.find((p) => p.id === "u-victor")!.must_change_password = true;
    await changeOwnPassword("u-victor", "mi-clave-nueva-1");
    expect(db.auth.updated).toEqual([{ id: "u-victor", attrs: { password: "mi-clave-nueva-1" } }]);
    expect(db.tables.perfiles!.find((p) => p.id === "u-victor")).toMatchObject({ must_change_password: false });
    expect(JSON.stringify(db.tables)).not.toContain("mi-clave-nueva-1");
  });

  it("si Auth falla, el cambio obligatorio NO se levanta", async () => {
    db.tables.perfiles!.find((p) => p.id === "u-victor")!.must_change_password = true;
    db.auth.updateError = { status: 500 };
    expect(await failure(changeOwnPassword("u-victor", "mi-clave-nueva-1"))).toMatchObject({ status: 500 });
    expect(db.tables.perfiles!.find((p) => p.id === "u-victor")).toMatchObject({ must_change_password: true });
  });

  it("contraseña corta o no textual → 400 sin llamar a Auth", async () => {
    for (const password of ["corta", undefined, 12345678901]) {
      expect(await failure(changeOwnPassword("u-victor", password))).toMatchObject({ status: 400 });
    }
    expect(db.auth.updated).toHaveLength(0);
  });
});
