import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

const PHONE = "+34688718820";

function seed(channels: { id: string; status: string }[] = [{ id: "canal-1", status: "connected" }]) {
  const fake = createFakeDb({
    empresas: [
      { id: 1, nombre: "Grupo" },
      { id: 2, nombre: "Otra" },
    ],
    marcas: [
      { id: 10, nombre: "Burger King" },
      { id: 20, nombre: "Popeyes" },
    ],
    restaurantes: [
      { id: 1, nombre: "Zizur", ciudad: "Zizur", empresa_id: 1, marca_id: 10, activo: true },
      { id: 2, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 10, activo: true },
      { id: 3, nombre: "Soria", ciudad: "Soria", empresa_id: 1, marca_id: 10, activo: true },
      { id: 4, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 20, activo: true },
      { id: 6, nombre: "Vault 1", ciudad: "Madrid", empresa_id: 2, marca_id: 20, activo: true },
    ],
    conv_canales: channels.map((c) => ({ ...c, provider: "whatsapp_cloud" })),
    conv_contactos: [],
    conv_conversaciones: [],
  });
  fake.uniques.conv_contactos = [{ columns: ["telefono_e164"], constraint: "conv_contactos_telefono_e164_key" }];
  fake.uniques.conv_conversaciones = [{ columns: ["canal_id", "contacto_id"], constraint: "conv_conversaciones_canal_id_contacto_id_key" }];
  return fake;
}

const { createManualContact } = await import("@/lib/conversations/manual-contact.server");

const access = { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2, 4] };
const create = (over: Partial<{ nombre: string | null; telefonoE164: string; access: Record<string, unknown> }> = {}) =>
  createManualContact({ nombre: "Víctor", telefonoE164: PHONE, access, ...over });

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error as { status: number; message: string }
  );
}

beforeEach(() => {
  db = seed();
});

describe("createManualContact", () => {
  it("crea el contacto y guarda sus permisos con la función transaccional (empresa y restaurantes elegidos aquí)", async () => {
    const result = await create();
    expect(result).toMatchObject({ status: "created" });

    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_contactos![0]).toMatchObject({ telefono_e164: PHONE });
    expect(db.rpcCalls).toEqual([
      {
        fn: "nexo_set_contact_access",
        args: {
          p_contacto_id: (result as { contactId: string }).contactId,
          p_nombre: "Víctor",
          p_tipo: "supervisor",
          p_empresa_id: 1,
          p_todos: false,
          p_restaurante_ids: [1, 2, 4],
        },
      },
    ]);
  });

  it("mezcla de marcas (BK + Popeyes) y 'todos los restaurantes' como opciones", async () => {
    await create({ access: { ...access, restaurantIds: [4, 1] } });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_restaurante_ids: [1, 4] });

    await create({ telefonoE164: "+34600000002", access: { tipo: "direccion", empresaId: 1, todosRestaurantes: true, restaurantIds: [1, 2] } });
    expect(db.rpcCalls[1]!.args).toMatchObject({ p_todos: true, p_restaurante_ids: [], p_tipo: "direccion" });
  });

  it("NO necesita cuenta web: no lee ni escribe perfiles, usuario_id ni asignaciones de cuentas", async () => {
    await create();
    expect(db.tables.perfiles ?? []).toHaveLength(0);
    expect(db.tables.usuario_restaurantes ?? []).toHaveLength(0);
    expect(db.tables.conv_contactos![0]!.usuario_id ?? null).toBeNull();
    expect(db.auth.created).toHaveLength(0);
  });

  it("sin empresa ni restaurantes: el contacto se crea sin permisos (deny by default)", async () => {
    await create({ access: {} });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_empresa_id: null, p_todos: false, p_restaurante_ids: [], p_tipo: null });
  });

  it("deja la conversación creada en la bandeja aunque la persona no haya escrito todavía", async () => {
    const result = await create();
    expect(result).toMatchObject({ conversationId: expect.any(String) });
    expect(db.tables.conv_conversaciones).toHaveLength(1);
    expect(db.tables.conv_mensajes ?? []).toHaveLength(0);
  });

  it("un restaurante de otra empresa se rechaza (400) antes de crear nada", async () => {
    const error = await failure(create({ access: { ...access, restaurantIds: [1, 6] } }));
    expect(error).toMatchObject({ status: 400 });
    expect(db.tables.conv_contactos).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("empresa o tipo inválidos → 400 sin crear nada", async () => {
    expect(await failure(create({ access: { ...access, empresaId: 99 } }))).toMatchObject({ status: 400 });
    expect(await failure(create({ access: { ...access, tipo: "restaurante_user" } }))).toMatchObject({ status: 400 });
    expect(db.tables.conv_contactos).toHaveLength(0);
  });

  it("un teléfono duplicado reutiliza el contacto: no se crea otro ni se tocan sus permisos", async () => {
    const first = await create();
    const second = await create({ nombre: "Otro nombre", access: { empresaId: 1, todosRestaurantes: true } });

    expect(second).toMatchObject({ status: "existing", contactId: (first as { contactId: string }).contactId });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_conversaciones).toHaveLength(1);
    // Solo la primera llamada guardó permisos: el contacto existente no se modifica desde el alta.
    expect(db.rpcCalls).toHaveLength(1);
  });

  it("si falla guardar los permisos, el contacto recién creado se retira (no queda uno sin su selección)", async () => {
    db.rpcResult = { error: { code: "08006" } };
    const error = await failure(create());
    expect(error).toMatchObject({ status: 500 });
    expect(db.tables.conv_contactos).toHaveLength(0);
    expect(db.tables.conv_conversaciones).toHaveLength(0);
  });

  it("sin canal conectado, o con varios, se crea el contacto pero no se abre conversación", async () => {
    db = seed([{ id: "canal-1", status: "disabled" }]);
    expect(await create()).toMatchObject({ status: "created", conversationId: null });
    expect(db.tables.conv_conversaciones).toHaveLength(0);

    db = seed([
      { id: "canal-1", status: "connected" },
      { id: "canal-2", status: "connected" },
    ]);
    expect(await create()).toMatchObject({ status: "created", conversationId: null });
  });

  it("una carrera con otra creación (mismo teléfono) acaba reutilizando el contacto sin tocarlo", async () => {
    const original = db.client.from;
    let first = true;
    db.client.from = (table: string) => {
      const builder = original(table) as { maybeSingle: () => Promise<unknown> };
      if (table === "conv_contactos" && first) {
        first = false;
        db.tables.conv_contactos!.push({ id: "c-carrera", telefono_e164: PHONE, nombre: null, usuario_id: null });
        const real = builder.maybeSingle;
        builder.maybeSingle = async () => {
          builder.maybeSingle = real;
          return { data: null, error: null }; // la primera lectura todavía no lo veía
        };
      }
      return builder;
    };
    expect(await create()).toMatchObject({ status: "existing", contactId: "c-carrera" });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("un error de base de datos se lanza sin copiar teléfonos ni nombres", async () => {
    db.failures.conv_contactos = { code: "08006", message: `${PHONE} Víctor` };
    await expect(create()).rejects.toMatchObject({ name: "ConversationsDbError", code: "08006" });
    await expect(create()).rejects.not.toMatchObject({ message: expect.stringContaining("34688") });
  });
});
