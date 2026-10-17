import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");
const sql = read("supabase/conv_delete_contact.sql");

// Orden real de borrado: se extrae de la función SQL que ejecuta la transacción ---------------------------
const DELETE_ORDER = [...sql.matchAll(/^\s*delete from public\.(\w+)/gim)].map((match) => match[1]!);

describe("función SQL nexo_delete_contact", () => {
  it("borra de hijos a padres, en el orden pedido, y termina con el contacto", () => {
    expect(DELETE_ORDER).toEqual([
      "conv_contacto_restaurantes",
      "conv_contacto_empresas",
      "conv_informe_envios",
      "conv_alertas_negativas",
      "conv_mensajes",
      "conv_conversaciones",
      "conv_contactos",
    ]);
  });

  it("solo toca tablas de Conversations: nunca auth, perfiles, empresas, restaurantes ni reseñas", () => {
    for (const table of DELETE_ORDER) expect(table.startsWith("conv_")).toBe(true);
    const code = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/auth\./i);
    expect(code).not.toMatch(/\b(delete from|update|truncate)\s+public\.(perfiles|empresas|restaurantes|resenas|marcas)\b/i);
    expect(code).not.toMatch(/delete from public\.conv_\w+\s*;/i); // ningún borrado sin WHERE
  });

  it("cada DELETE se limita al contacto recibido (no afecta a otros)", () => {
    const statements = [...sql.matchAll(/delete from public\.(\w+)([^;]*);/gi)];
    expect(statements).toHaveLength(7);
    for (const [, table, rest] of statements) {
      expect(rest, table).toMatch(/p_contacto_id/);
    }
  });

  it("es una única función plpgsql (atómica), bloquea al contacto, falla con P0002 y solo la ejecuta service_role", () => {
    expect(sql).toMatch(/language plpgsql/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/errcode = 'P0002'/);
    expect(sql).toMatch(/revoke all on function public\.nexo_delete_contact\(uuid\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.nexo_delete_contact\(uuid\) to service_role/);
    expect(sql).not.toMatch(/\b(commit|rollback)\b\s*;/i);
  });
});

// Modelo en memoria con las claves foráneas REALES de la base ---------------------------------------------
type Row = Record<string, unknown>;
type Fk = { child: string; childCols: string[]; parent: string; parentCols: string[]; onDelete: "restrict" | "cascade" | "set_null" };

const FKS: Fk[] = [
  { child: "conv_conversaciones", childCols: ["contacto_id"], parent: "conv_contactos", parentCols: ["id"], onDelete: "restrict" },
  { child: "conv_contacto_empresas", childCols: ["contacto_id"], parent: "conv_contactos", parentCols: ["id"], onDelete: "restrict" },
  { child: "conv_contacto_restaurantes", childCols: ["contacto_id", "empresa_id"], parent: "conv_contacto_empresas", parentCols: ["contacto_id", "empresa_id"], onDelete: "restrict" },
  { child: "conv_mensajes", childCols: ["conversacion_id"], parent: "conv_conversaciones", parentCols: ["id"], onDelete: "restrict" },
  { child: "conv_alertas_negativas", childCols: ["contacto_id"], parent: "conv_contactos", parentCols: ["id"], onDelete: "cascade" },
  { child: "conv_informe_envios", childCols: ["contacto_id"], parent: "conv_contactos", parentCols: ["id"], onDelete: "cascade" },
  { child: "conv_alertas_negativas", childCols: ["conversacion_id"], parent: "conv_conversaciones", parentCols: ["id"], onDelete: "set_null" },
  { child: "conv_informe_envios", childCols: ["conversacion_id"], parent: "conv_conversaciones", parentCols: ["id"], onDelete: "set_null" },
  { child: "conv_informe_envios", childCols: ["mensaje_id"], parent: "conv_mensajes", parentCols: ["id"], onDelete: "set_null" },
];

class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Tablas fuera de Conversations: nunca deben cambiar. */
  constructor(initial: Record<string, Row[]>) {
    this.tables = structuredClone(initial);
  }
  snapshot() {
    return structuredClone(this.tables);
  }
  restore(snapshot: Record<string, Row[]>) {
    this.tables = structuredClone(snapshot);
  }
  private matches(row: Row, cols: string[], values: unknown[]) {
    return cols.every((col, index) => row[col] === values[index] && row[col] != null);
  }
  deleteWhere(table: string, predicate: (row: Row) => boolean) {
    const doomed = (this.tables[table] ?? []).filter(predicate);
    for (const row of doomed) {
      for (const fk of FKS.filter((item) => item.parent === table)) {
        const values = fk.parentCols.map((col) => row[col]);
        const children = (this.tables[fk.child] ?? []).filter((child) => this.matches(child, fk.childCols, values) && !doomed.includes(child));
        if (children.length === 0) continue;
        if (fk.onDelete === "restrict") throw new Error(`FK ${fk.child}→${table} (RESTRICT) bloquea el borrado`);
        if (fk.onDelete === "cascade") this.deleteWhere(fk.child, (child) => children.includes(child));
        else for (const child of children) for (const col of fk.childCols) child[col] = null;
      }
    }
    this.tables[table] = (this.tables[table] ?? []).filter((row) => !doomed.includes(row));
    return doomed.length;
  }
}

/** Ejecuta los pasos de la función SQL (en el orden extraído del archivo) dentro de una transacción. */
function runDeleteContact(db: FakeDb, contactId: string, failAtStep?: number) {
  const exists = db.tables.conv_contactos!.some((row) => row.id === contactId);
  if (!exists) throw Object.assign(new Error("contacto no encontrado"), { code: "P0002" });

  const conversationIds = () => db.tables.conv_conversaciones!.filter((row) => row.contacto_id === contactId).map((row) => row.id);
  const steps: Record<string, () => number> = {
    conv_contacto_restaurantes: () => db.deleteWhere("conv_contacto_restaurantes", (row) => row.contacto_id === contactId),
    conv_contacto_empresas: () => db.deleteWhere("conv_contacto_empresas", (row) => row.contacto_id === contactId),
    conv_informe_envios: () => db.deleteWhere("conv_informe_envios", (row) => row.contacto_id === contactId),
    conv_alertas_negativas: () => db.deleteWhere("conv_alertas_negativas", (row) => row.contacto_id === contactId),
    conv_mensajes: () => {
      const ids = conversationIds();
      return db.deleteWhere("conv_mensajes", (row) => ids.includes(row.conversacion_id));
    },
    conv_conversaciones: () => db.deleteWhere("conv_conversaciones", (row) => row.contacto_id === contactId),
    conv_contactos: () => db.deleteWhere("conv_contactos", (row) => row.id === contactId),
  };

  const before = db.snapshot();
  try {
    DELETE_ORDER.forEach((table, index) => {
      if (failAtStep === index) throw new Error(`fallo intermedio en el paso ${index + 1} (${table})`);
      steps[table]!();
    });
  } catch (error) {
    db.restore(before); // todo o nada
    throw error;
  }
}

function seed(): FakeDb {
  return new FakeDb({
    // Fuera de Conversations: no se tocan nunca.
    auth_users: [{ id: "u-1" }, { id: "u-2" }],
    perfiles: [{ id: "u-1", rol: "empresa_admin" }, { id: "u-2", rol: "marca_admin" }],
    empresas: [{ id: 1 }],
    restaurantes: [{ id: 9, empresa_id: 1 }],
    resenas: [{ id: 1, restaurante_id: 9 }],
    // Conversations.
    conv_contactos: [
      { id: "A", usuario_id: "u-1" }, // vinculado a una cuenta web
      { id: "B", usuario_id: "u-2" },
    ],
    conv_contacto_empresas: [
      { contacto_id: "A", empresa_id: 1 },
      { contacto_id: "B", empresa_id: 1 },
    ],
    conv_contacto_restaurantes: [
      { contacto_id: "A", empresa_id: 1, restaurante_id: 9 },
      { contacto_id: "B", empresa_id: 1, restaurante_id: 9 },
    ],
    conv_conversaciones: [
      { id: "ca", contacto_id: "A" },
      { id: "cb", contacto_id: "B" },
    ],
    conv_mensajes: [
      { id: "m1", conversacion_id: "ca" },
      { id: "m2", conversacion_id: "ca" },
      { id: "m3", conversacion_id: "cb" },
    ],
    conv_alertas_negativas: [
      { id: "al-a", contacto_id: "A", conversacion_id: "ca" },
      { id: "al-b", contacto_id: "B", conversacion_id: "cb" },
    ],
    conv_informe_envios: [
      { id: "in-a", contacto_id: "A", conversacion_id: "ca", mensaje_id: "m1" },
      { id: "in-b", contacto_id: "B", conversacion_id: "cb", mensaje_id: "m3" },
    ],
  });
}

const count = (db: FakeDb, table: string, predicate: (row: Row) => boolean = () => true) => (db.tables[table] ?? []).filter(predicate).length;

describe("borrado transaccional del contacto (modelo con las FK reales)", () => {
  it("un DELETE directo sobre conv_contactos falla por las FK RESTRICT: por eso hace falta el orden", () => {
    const db = seed();
    expect(() => db.deleteWhere("conv_contactos", (row) => row.id === "A")).toThrow(/RESTRICT/);
  });

  it("el orden del archivo SQL respeta todas las FK y elimina el contacto", () => {
    const db = seed();
    expect(() => runDeleteContact(db, "A")).not.toThrow();
    expect(count(db, "conv_contactos", (row) => row.id === "A")).toBe(0);
  });

  it("elimina sus permisos (empresas y restaurantes)", () => {
    const db = seed();
    runDeleteContact(db, "A");
    expect(count(db, "conv_contacto_empresas", (row) => row.contacto_id === "A")).toBe(0);
    expect(count(db, "conv_contacto_restaurantes", (row) => row.contacto_id === "A")).toBe(0);
  });

  it("elimina sus mensajes y conversaciones", () => {
    const db = seed();
    runDeleteContact(db, "A");
    expect(count(db, "conv_conversaciones", (row) => row.contacto_id === "A")).toBe(0);
    expect(count(db, "conv_mensajes", (row) => row.conversacion_id === "ca")).toBe(0);
  });

  it("elimina sus alertas negativas e informes (aunque apunten a sus mensajes y conversaciones)", () => {
    const db = seed();
    runDeleteContact(db, "A");
    expect(count(db, "conv_alertas_negativas", (row) => row.contacto_id === "A")).toBe(0);
    expect(count(db, "conv_informe_envios", (row) => row.contacto_id === "A")).toBe(0);
  });

  it("no borra auth, perfiles, empresas, restaurantes ni reseñas, aunque el contacto estuviera vinculado a una cuenta web", () => {
    const db = seed();
    const outside = ["auth_users", "perfiles", "empresas", "restaurantes", "resenas"];
    const before = Object.fromEntries(outside.map((table) => [table, structuredClone(db.tables[table])]));
    runDeleteContact(db, "A");
    for (const table of outside) expect(db.tables[table], table).toEqual(before[table]);
    expect(db.tables.auth_users!.some((row) => row.id === "u-1")).toBe(true);
    expect(db.tables.perfiles!.some((row) => row.id === "u-1")).toBe(true);
  });

  it("no afecta a otros contactos: B conserva todo", () => {
    const db = seed();
    runDeleteContact(db, "A");
    expect(count(db, "conv_contactos", (row) => row.id === "B")).toBe(1);
    expect(count(db, "conv_contacto_empresas", (row) => row.contacto_id === "B")).toBe(1);
    expect(count(db, "conv_contacto_restaurantes", (row) => row.contacto_id === "B")).toBe(1);
    expect(count(db, "conv_conversaciones", (row) => row.contacto_id === "B")).toBe(1);
    expect(count(db, "conv_mensajes", (row) => row.conversacion_id === "cb")).toBe(1);
    expect(db.tables.conv_alertas_negativas).toEqual([{ id: "al-b", contacto_id: "B", conversacion_id: "cb" }]);
    expect(db.tables.conv_informe_envios).toEqual([{ id: "in-b", contacto_id: "B", conversacion_id: "cb", mensaje_id: "m3" }]);
  });

  it.each(DELETE_ORDER.map((table, index) => [index, table] as const))(
    "fallo intermedio en el paso %i (%s): rollback completo, no queda nada a medias",
    (index) => {
      const db = seed();
      const original = db.snapshot();
      expect(() => runDeleteContact(db, "A", index)).toThrow(/fallo intermedio/);
      expect(db.tables).toEqual(original);
    }
  );

  it("contacto inexistente → P0002 y no cambia nada", () => {
    const db = seed();
    const original = db.snapshot();
    expect(() => runDeleteContact(db, "no-existe")).toThrow(expect.objectContaining({ code: "P0002" }));
    expect(db.tables).toEqual(original);
  });
});

// Capa de servidor y ruta -------------------------------------------------------------------------------
const requireApiAuth = vi.fn();
const rpc = vi.fn();
const conversationLookup = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: conversationLookup }) }),
    }),
  }),
}));

const { deleteConversationContact } = await import("@/lib/conversations/contact-link.server");
const route = await import("@/app/api/conversations/[conversationId]/contact/route");

const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
const CONTACT_ID = "99999999-8888-4777-8666-555555555555";

describe("deleteConversationContact (servidor)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    conversationLookup.mockResolvedValue({ data: { contacto_id: CONTACT_ID }, error: null });
    rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("resuelve el contacto desde la conversación y llama a la función transaccional con ESE id", async () => {
    expect(await deleteConversationContact(CONVERSATION_ID)).toBe("deleted");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("nexo_delete_contact", { p_contacto_id: CONTACT_ID });
  });

  it("conversación inexistente → not_found sin llamar a la base de borrado", async () => {
    conversationLookup.mockResolvedValue({ data: null, error: null });
    expect(await deleteConversationContact(CONVERSATION_ID)).toBe("not_found");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("contacto desaparecido entre medias (P0002) → not_found", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "contacto no encontrado" } });
    expect(await deleteConversationContact(CONVERSATION_ID)).toBe("not_found");
  });

  it("cualquier otro error se propaga con solo el SQLSTATE (sin valores)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23503", message: "violates foreign key for +34600111222" } });
    const error = await deleteConversationContact(CONVERSATION_ID).catch((e) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).not.toContain("+34");
  });
});

describe("DELETE /api/conversations/[id]/contact", () => {
  const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
  const del = (id = CONVERSATION_ID, body?: unknown) =>
    route.DELETE(
      new Request(`https://nexo.example/api/conversations/${id}/contact`, {
        method: "DELETE",
        ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      }),
      { params: Promise.resolve({ conversationId: id }) }
    );

  beforeEach(() => {
    vi.resetAllMocks();
    asRole("super_admin");
    conversationLookup.mockResolvedValue({ data: { contacto_id: CONTACT_ID }, error: null });
    rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("super_admin elimina: 200 { deleted: true }", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(rpc).toHaveBeenCalledWith("nexo_delete_contact", { p_contacto_id: CONTACT_ID });
  });

  it("usuario no autorizado: 401 sin sesión y 403 para cualquier otro rol; no se borra nada", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await del()).status).toBe(401);
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      asRole(rol);
      expect((await del()).status).toBe(403);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no acepta un contacto_id del cliente: manda el de la conversación de la ruta", async () => {
    await del(CONVERSATION_ID, { contacto_id: "otro-contacto", contactoId: "otro", id: "otro" });
    expect(rpc).toHaveBeenCalledWith("nexo_delete_contact", { p_contacto_id: CONTACT_ID });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("identificador de conversación no válido → 400", async () => {
    expect((await del("no-uuid")).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("el contacto no existe → 404", async () => {
    conversationLookup.mockResolvedValue({ data: null, error: null });
    expect((await del()).status).toBe(404);
    rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    conversationLookup.mockResolvedValue({ data: { contacto_id: CONTACT_ID }, error: null });
    expect((await del()).status).toBe(404);
  });

  it("falla la transacción → 500 con un mensaje claro (no se ha borrado nada) y sin datos en el log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "XX001", message: "boom +34600111222" } });
    const res = await del();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("No se pudo eliminar el contacto");
    expect(body.error).toContain("No se ha borrado nada");
    expect(String(spy.mock.calls[0]?.join(" "))).not.toContain("+34");
    spy.mockRestore();
  });
});

describe("interfaz: zona de peligro", () => {
  const panel = read("app/dashboard/conversaciones/_components/contact-info-panel.tsx");
  const view = read("app/dashboard/conversaciones/conversations-view.tsx");

  it("botón rojo 'Eliminar contacto' y confirmación con el texto pedido y Cancelar / Eliminar contacto", () => {
    expect(panel).toContain("Eliminar contacto");
    expect(panel).toContain("¿Seguro que quieres eliminar este contacto?");
    expect(panel).toContain("Se eliminarán sus permisos, conversaciones, mensajes, alertas e informes asociados. Esta acción no se puede deshacer.");
    expect(panel).toContain("Cancelar");
    expect(panel).toContain('role="alertdialog"');
    expect(panel).toContain('method: "DELETE"');
    expect(panel).toContain("/contact`");
    // La zona de peligro es lo último de la ficha.
    expect(panel.lastIndexOf("<DangerZone")).toBeGreaterThan(panel.lastIndexOf("<TemplateTestCard"));
  });

  it("al eliminar: cierra la ficha, refresca la lista y muestra 'Contacto eliminado'", () => {
    expect(view).toContain("onDeleted={contactDeleted}");
    expect(view).toContain('setNotice("Contacto eliminado")');
    expect(view).toMatch(/function contactDeleted\(\) \{[\s\S]*back\(\);[\s\S]*loadList\(\)/);
  });
});
