import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";

let db: FakeDb;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

function seed() {
  return createFakeDb({
    empresas: [{ id: 1, nombre: "Grupo" }],
    marcas: [{ id: 10, nombre: "Burger King" }],
    restaurantes: [
      { id: 1, nombre: "Zizur", ciudad: "Zizur", empresa_id: 1, marca_id: 10, activo: true },
      { id: 2, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 10, activo: true },
    ],
    perfiles: [
      { id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 },
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
    ],
    usuario_marcas: [],
    usuario_restaurantes: [{ user_id: "u-victor", restaurante_id: 1 }],
    conv_conversaciones: [
      { id: "conv-1", contacto_id: "c-1" },
      { id: "conv-2", contacto_id: "c-2" },
    ],
    conv_contactos: [
      { id: "c-1", telefono_e164: "+34600111222", nombre: null, nombre_perfil: "Víctor WA", usuario_id: null },
      { id: "c-2", telefono_e164: "+34600333444", nombre: "Pilar", nombre_perfil: null, usuario_id: "u-pilar" },
    ],
  });
}

const { getConversationContactAccess, listLinkableUsers, setConversationContactUser } = await import(
  "@/lib/conversations/contact-link.server"
);

beforeEach(() => {
  db = seed();
});

describe("vínculo contacto ↔ usuario de Nexo", () => {
  it("un contacto sin usuario aparece sin acceso (deny by default)", async () => {
    const summary = await getConversationContactAccess("conv-1");
    expect(summary).toMatchObject({ displayName: "Víctor WA", phone: "+34600111222", linkedUser: null });
    expect(summary!.access).toEqual({ count: 0, restaurants: [] });
  });

  it("vincular guarda conv_contactos.usuario_id y el acceso pasa a ser el del usuario", async () => {
    expect(await setConversationContactUser("conv-1", "u-victor")).toBe("ok");
    expect(db.tables.conv_contactos!.find((c) => c.id === "c-1")!.usuario_id).toBe("u-victor");

    const summary = await getConversationContactAccess("conv-1");
    expect(summary!.linkedUser).toMatchObject({ id: "u-victor", nombre: "Víctor", rol: "restaurante_user", empresaNombre: "Grupo" });
    expect(summary!.access.count).toBe(1);
    expect(summary!.access.restaurants.map((r) => r.name)).toEqual(["Zizur"]);
  });

  it("el acceso mostrado sigue a los permisos: cambia sin volver a vincular", async () => {
    await setConversationContactUser("conv-1", "u-victor");
    db.tables.usuario_restaurantes!.push({ user_id: "u-victor", restaurante_id: 2 });
    expect((await getConversationContactAccess("conv-1"))!.access.count).toBe(2);
  });

  it("un empresa_admin vinculado muestra todos los restaurantes de su empresa", async () => {
    const summary = await getConversationContactAccess("conv-2");
    expect(summary!.linkedUser).toMatchObject({ rol: "empresa_admin" });
    expect(summary!.access.count).toBe(2);
  });

  it("desvincular (null) deja al contacto sin acceso", async () => {
    expect(await setConversationContactUser("conv-2", null)).toBe("ok");
    const summary = await getConversationContactAccess("conv-2");
    expect(summary!.linkedUser).toBeNull();
    expect(summary!.access.count).toBe(0);
  });

  it("dos teléfonos no pueden vincularse al mismo usuario (índice único)", async () => {
    db.failures.conv_contactos = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "conv_contactos_usuario_id_key"',
    };
    expect(await setConversationContactUser("conv-1", "u-pilar")).toBe("already_linked");
  });

  it("otros errores de base de datos se lanzan sin copiar el mensaje", async () => {
    db.failures.conv_contactos = { code: "08006", message: "+34600111222" };
    await expect(setConversationContactUser("conv-1", "u-victor")).rejects.toMatchObject({ code: "08006" });
    await expect(setConversationContactUser("conv-1", "u-victor")).rejects.not.toMatchObject({
      message: expect.stringContaining("34600"),
    });
  });

  it("usuario inexistente o conversación inexistente", async () => {
    expect(await setConversationContactUser("conv-1", "u-nadie")).toBe("user_not_found");
    expect(await setConversationContactUser("conv-x", "u-victor")).toBe("conversation_not_found");
    expect(db.tables.conv_contactos!.find((c) => c.id === "c-1")!.usuario_id).toBeNull();
  });

  it("la lista de usuarios marca los ya vinculados a otro teléfono", async () => {
    const users = await listLinkableUsers("conv-1");
    expect(users.find((u) => u.id === "u-pilar")).toMatchObject({ linkedElsewhere: true, empresaNombre: "Grupo" });
    expect(users.find((u) => u.id === "u-victor")).toMatchObject({ linkedElsewhere: false });
    // El usuario del propio contacto no cuenta como "otro teléfono".
    expect((await listLinkableUsers("conv-2")).find((u) => u.id === "u-pilar")!.linkedElsewhere).toBe(false);
  });

  it("el resumen no contiene datos internos de la fila (ni usuario_id crudo, ni raw_payload)", async () => {
    await setConversationContactUser("conv-1", "u-victor");
    const json = JSON.stringify(await getConversationContactAccess("conv-1"));
    for (const hidden of ["raw_payload", "usuario_id", "external_contact_id", "v@x.test"]) {
      expect(json).not.toContain(hidden);
    }
  });
});
