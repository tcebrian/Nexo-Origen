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
    ],
    restaurantes: [
      { id: 1, nombre: "Zizur", ciudad: "Zizur", empresa_id: 1, marca_id: 10, activo: true },
      { id: 2, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 10, activo: true },
      { id: 3, nombre: "Soria", ciudad: "Soria", empresa_id: 1, marca_id: 10, activo: true },
      { id: 4, nombre: "Tudela", ciudad: "Tudela", empresa_id: 1, marca_id: 20, activo: true },
      { id: 6, nombre: "Vault 1", ciudad: "Madrid", empresa_id: 2, marca_id: 20, activo: true },
    ],
    perfiles: [
      { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
      { id: "u-soria", nombre: "Burger King Soria", email: "s@x.test", rol: "restaurante_user", empresa_id: 1 },
    ],
    usuario_restaurantes: [{ user_id: "u-soria", restaurante_id: 3 }],
    usuario_marcas: [],
    conv_conversaciones: [
      { id: "conv-1", contacto_id: "c-1" },
      { id: "conv-2", contacto_id: "c-2" },
    ],
    conv_contactos: [
      { id: "c-1", telefono_e164: "+34600111222", nombre: "Víctor", nombre_perfil: null, tipo: "supervisor", usuario_id: null },
      { id: "c-2", telefono_e164: "+34600333444", nombre: null, nombre_perfil: "Pilar WA", tipo: null, usuario_id: "u-pilar" },
    ],
    conv_contacto_empresas: [{ contacto_id: "c-1", empresa_id: 1, todos_restaurantes: false }],
    conv_contacto_restaurantes: [
      { contacto_id: "c-1", empresa_id: 1, restaurante_id: 1 },
      { contacto_id: "c-1", empresa_id: 1, restaurante_id: 4 },
    ],
  });
}

const { getConversationContactDetail, listLinkableUsers, setConversationContactUser, updateConversationContact } = await import(
  "@/lib/conversations/contact-link.server"
);

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error as { status: number; message: string }
  );
}

beforeEach(() => {
  db = seed();
});

describe("ficha del contacto", () => {
  it("muestra lo guardado y los restaurantes que puede consultar hoy", async () => {
    const detail = (await getConversationContactDetail("conv-1"))!;
    expect(detail).toMatchObject({ displayName: "Víctor", phone: "+34600111222", nombre: "Víctor", tipo: "supervisor" });
    expect(detail.selection).toEqual({ empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 4] });
    expect(detail.access.count).toBe(2);
    expect(detail.access.restaurants.map((r) => `${r.brand} ${r.name}`)).toEqual(["Burger King Zizur", "Popeyes Tudela"]);
    expect(detail.linkedUser).toBeNull();
  });

  it("un contacto sin permisos aparece sin acceso, con o sin cuenta web", async () => {
    const detail = (await getConversationContactDetail("conv-2"))!;
    expect(detail.access).toEqual({ count: 0, restaurants: [] });
    expect(detail.selection).toEqual({ empresaId: null, todosRestaurantes: false, restaurantIds: [] });
    // La cuenta vinculada (empresa_admin) es solo informativa: no le da acceso.
    expect(detail.linkedUser).toMatchObject({ id: "u-pilar", nombre: "Pilar", rol: "empresa_admin", empresaNombre: "Grupo" });
  });

  it("no expone usuario_id, raw_payload ni emails", async () => {
    const json = JSON.stringify(await getConversationContactDetail("conv-2"));
    for (const hidden of ["usuario_id", "raw_payload", "p@x.test", "external_contact_id"]) expect(json).not.toContain(hidden);
  });

  it("conversación inexistente → null", async () => {
    expect(await getConversationContactDetail("conv-x")).toBeNull();
  });
});

describe("edición de permisos del contacto", () => {
  it("guarda nombre, tipo, empresa, 'todos' y restaurantes con una única función transaccional", async () => {
    await updateConversationContact("conv-1", {
      nombre: " Víctor S. ",
      tipo: "operaciones",
      empresaId: 1,
      todosRestaurantes: false,
      restaurantIds: [4, 1],
    });
    expect(db.rpcCalls).toEqual([
      {
        fn: "nexo_set_contact_access",
        args: { p_contacto_id: "c-1", p_nombre: "Víctor S.", p_tipo: "operaciones", p_empresa_id: 1, p_todos: false, p_restaurante_ids: [1, 4] },
      },
    ]);
  });

  it("la selección enviada es la final: Zizur, Tudela, Calahorra → Zizur, Utebo viaja entera (no una suma)", async () => {
    await updateConversationContact("conv-1", { empresaId: 1, restaurantIds: [1, 3] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_restaurante_ids: [1, 3], p_empresa_id: 1, p_todos: false });
  });

  it("todos los restaurantes: no viaja ninguna lista", async () => {
    await updateConversationContact("conv-1", { empresaId: 1, todosRestaurantes: true, restaurantIds: [1, 2] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_todos: true, p_restaurante_ids: [] });
  });

  it("quitar la empresa deja al contacto sin acceso", async () => {
    await updateConversationContact("conv-1", { empresaId: null, restaurantIds: [1] });
    expect(db.rpcCalls[0]!.args).toMatchObject({ p_empresa_id: null, p_todos: false, p_restaurante_ids: [] });
  });

  it("un restaurante de otra empresa se rechaza antes de llegar a la base de datos", async () => {
    expect(await failure(updateConversationContact("conv-1", { empresaId: 1, restaurantIds: [1, 6] }))).toMatchObject({ status: 400 });
    expect(await failure(updateConversationContact("conv-1", { empresaId: 2, restaurantIds: [1] }))).toMatchObject({ status: 400 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("tipo inválido, o un rol web como tipo, o nombre demasiado largo → 400", async () => {
    expect(await failure(updateConversationContact("conv-1", { tipo: "restaurante_user", empresaId: 1 }))).toMatchObject({ status: 400 });
    expect(await failure(updateConversationContact("conv-1", { nombre: "a".repeat(101), empresaId: 1 }))).toMatchObject({ status: 400 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("conversación inexistente → 404", async () => {
    expect(await failure(updateConversationContact("conv-x", { empresaId: 1 }))).toMatchObject({ status: 404 });
  });

  it("los errores de la función SQL se traducen sin copiar el mensaje de la base de datos", async () => {
    for (const [code, status] of [["22023", 400], ["P0002", 404], ["08006", 500]] as const) {
      db.rpcResult = { error: { code } };
      const error = await failure(updateConversationContact("conv-1", { empresaId: 1, restaurantIds: [1] }));
      expect(error).toMatchObject({ status });
      expect(error!.message).not.toMatch(/34600|Víctor|23505/);
    }
  });

  it("editar permisos no toca cuentas web ni sus asignaciones", async () => {
    await updateConversationContact("conv-1", { empresaId: 1, todosRestaurantes: true });
    expect(db.tables.usuario_restaurantes).toEqual([{ user_id: "u-soria", restaurante_id: 3 }]);
    expect(db.tables.perfiles!.find((p) => p.id === "u-soria")).toMatchObject({ rol: "restaurante_user" });
    expect(db.auth.created).toHaveLength(0);
  });
});

describe("cuenta web vinculada (opcional, informativa)", () => {
  it("vincular guarda usuario_id sin tocar los permisos del contacto", async () => {
    expect(await setConversationContactUser("conv-1", "u-soria")).toBe("ok");
    expect(db.tables.conv_contactos!.find((c) => c.id === "c-1")!.usuario_id).toBe("u-soria");

    const detail = (await getConversationContactDetail("conv-1"))!;
    // La cuenta "Burger King Soria" tiene el restaurante 3, pero el contacto sigue con SUS restaurantes.
    expect(detail.access.restaurants.map((r) => r.id)).toEqual([1, 4]);
    expect(detail.linkedUser).toMatchObject({ nombre: "Burger King Soria", rol: "restaurante_user" });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("desvincular (null) no quita permisos", async () => {
    expect(await setConversationContactUser("conv-2", null)).toBe("ok");
    expect((await getConversationContactDetail("conv-2"))!.linkedUser).toBeNull();
  });

  it("una cuenta no puede estar vinculada a dos teléfonos", async () => {
    db.uniques.conv_contactos = [{ columns: ["usuario_id"], constraint: "conv_contactos_usuario_id_key" }];
    expect(await setConversationContactUser("conv-1", "u-pilar")).toBe("already_linked");
  });

  it("cuenta o conversación inexistente", async () => {
    expect(await setConversationContactUser("conv-1", "u-nadie")).toBe("user_not_found");
    expect(await setConversationContactUser("conv-x", "u-soria")).toBe("conversation_not_found");
  });

  it("la lista marca las cuentas ya vinculadas a otro teléfono", async () => {
    const users = await listLinkableUsers("conv-1");
    expect(users.find((u) => u.id === "u-pilar")).toMatchObject({ linkedElsewhere: true, empresaNombre: "Grupo" });
    expect(users.find((u) => u.id === "u-soria")).toMatchObject({ linkedElsewhere: false });
    expect((await listLinkableUsers("conv-2")).find((u) => u.id === "u-pilar")!.linkedElsewhere).toBe(false);
  });
});
