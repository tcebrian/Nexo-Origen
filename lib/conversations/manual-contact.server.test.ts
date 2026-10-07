import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

const PHONE = "+34688718820";

function seed(channels: { id: string; status: string }[] = [{ id: "canal-1", status: "connected" }]) {
  const fake = createFakeDb({
    perfiles: [
      { id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 },
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
    ],
    conv_canales: channels.map((c) => ({ ...c, provider: "whatsapp_cloud" })),
    conv_contactos: [],
    conv_conversaciones: [],
  });
  fake.uniques.conv_contactos = [
    { columns: ["telefono_e164"], constraint: "conv_contactos_telefono_e164_key" },
    { columns: ["usuario_id"], constraint: "conv_contactos_usuario_id_key" },
  ];
  fake.uniques.conv_conversaciones = [{ columns: ["canal_id", "contacto_id"], constraint: "conv_conversaciones_canal_id_contacto_id_key" }];
  return fake;
}

const { createManualContact } = await import("@/lib/conversations/manual-contact.server");

const create = (over: Partial<{ nombre: string | null; telefonoE164: string; usuarioId: string | null }> = {}) =>
  createManualContact({ nombre: "Víctor", telefonoE164: PHONE, usuarioId: null, ...over });

beforeEach(() => {
  db = seed();
});

describe("createManualContact", () => {
  it("crea el contacto con su nombre y SIN usuario vinculado (sin acceso a datos)", async () => {
    const result = await create();
    expect(result).toMatchObject({ status: "created", linked: false });

    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_contactos![0]).toMatchObject({ telefono_e164: PHONE, nombre: "Víctor" });
    expect(db.tables.conv_contactos![0]!.usuario_id ?? null).toBeNull();
  });

  it("deja la conversación creada en la bandeja aunque la persona no haya escrito todavía", async () => {
    const result = await create();
    expect(result).toMatchObject({ conversationId: expect.any(String) });
    expect(db.tables.conv_conversaciones).toHaveLength(1);
    expect(db.tables.conv_conversaciones![0]).toMatchObject({ canal_id: "canal-1" });
    // Sin mensajes: no se inventa ninguno.
    expect(db.tables.conv_mensajes ?? []).toHaveLength(0);
  });

  it("con usuario Nexo, queda vinculado en conv_contactos.usuario_id", async () => {
    const result = await create({ usuarioId: "u-victor" });
    expect(result).toMatchObject({ status: "created", linked: true });
    expect(db.tables.conv_contactos![0]!.usuario_id).toBe("u-victor");
  });

  it("no toca permisos ni restaurantes: solo escribe en conv_contactos y conv_conversaciones", async () => {
    await create({ usuarioId: "u-victor" });
    expect(db.tables.usuario_restaurantes ?? []).toHaveLength(0);
    expect(db.tables.usuario_marcas ?? []).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.tables.perfiles!.find((p) => p.id === "u-victor")).toMatchObject({ rol: "restaurante_user", empresa_id: 1 });
  });

  it("usuario inexistente → user_not_found y no se crea nada", async () => {
    expect(await create({ usuarioId: "u-nadie" })).toEqual({ status: "user_not_found" });
    expect(db.tables.conv_contactos).toHaveLength(0);
  });

  it("un teléfono duplicado reutiliza el contacto existente: no se crea otro", async () => {
    const first = await create();
    const second = await create({ nombre: "Otro nombre" });

    expect(second).toMatchObject({ status: "existing", contactId: (first as { contactId: string }).contactId });
    expect(db.tables.conv_contactos).toHaveLength(1);
    expect(db.tables.conv_conversaciones).toHaveLength(1);
  });

  it("al reutilizar NO sobrescribe el nombre ni el usuario vinculado", async () => {
    await create({ nombre: "Víctor", usuarioId: "u-victor" });
    const again = await create({ nombre: "Otro nombre", usuarioId: null });

    expect(again).toMatchObject({ status: "existing", linked: true });
    expect(db.tables.conv_contactos![0]).toMatchObject({ nombre: "Víctor", usuario_id: "u-victor" });
  });

  it("un contacto existente sin vincular se puede vincular desde el alta", async () => {
    await create();
    const linked = await create({ usuarioId: "u-victor" });
    expect(linked).toMatchObject({ status: "existing", linked: true });
    expect(db.tables.conv_contactos![0]!.usuario_id).toBe("u-victor");
  });

  it("si el número ya está vinculado a OTRO usuario, no se sobrescribe y se avisa", async () => {
    await create({ usuarioId: "u-victor" });
    expect(await create({ usuarioId: "u-pilar" })).toEqual({ status: "phone_linked_to_other_user" });
    expect(db.tables.conv_contactos![0]!.usuario_id).toBe("u-victor");
  });

  it("un usuario ya vinculado a otro teléfono → user_already_linked (conflicto 409)", async () => {
    await create({ usuarioId: "u-victor" });
    expect(await create({ telefonoE164: "+34600000002", nombre: "Segundo", usuarioId: "u-victor" })).toEqual({
      status: "user_already_linked",
    });
    expect(db.tables.conv_contactos).toHaveLength(1);

    // También al vincular un contacto ya existente sin vincular.
    await create({ telefonoE164: "+34600000003", nombre: "Tercero" });
    expect(await create({ telefonoE164: "+34600000003", usuarioId: "u-victor" })).toEqual({ status: "user_already_linked" });
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

  it("una carrera con otra creación (mismo teléfono) acaba reutilizando el contacto", async () => {
    // La inserción choca con la restricción única: el contacto ya existe cuando se relee.
    const select = db.client.from.bind(db.client);
    let first = true;
    db.client.from = (table: string) => {
      const builder = select(table) as { maybeSingle: () => Promise<unknown> };
      if (table === "conv_contactos" && first) {
        first = false;
        db.tables.conv_contactos!.push({ id: "c-carrera", telefono_e164: PHONE, nombre: null, usuario_id: null });
        const original = builder.maybeSingle;
        builder.maybeSingle = async () => {
          // La primera lectura todavía no lo veía.
          builder.maybeSingle = original;
          return { data: null, error: null };
        };
      }
      return builder;
    };
    expect(await create()).toMatchObject({ status: "existing", contactId: "c-carrera" });
    expect(db.tables.conv_contactos).toHaveLength(1);
  });

  it("un error de base de datos se lanza sin copiar teléfonos ni nombres", async () => {
    db.failures.conv_contactos = { code: "08006", message: `${PHONE} Víctor` };
    await expect(create()).rejects.toMatchObject({ name: "ConversationsDbError", code: "08006" });
    await expect(create()).rejects.not.toMatchObject({ message: expect.stringContaining("34688") });
  });
});
