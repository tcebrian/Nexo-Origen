import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/conversations/fake-supabase.test-helper";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

const db = createFakeDb({
  empresas: [{ id: 1, nombre: "Grupo" }],
  marcas: [{ id: 10, nombre: "Burger King" }],
  restaurantes: [
    { id: 1, empresa_id: 1, marca_id: 10 },
    { id: 2, empresa_id: 1, marca_id: 10 },
    { id: 3, empresa_id: 1, marca_id: 10 },
  ],
  perfiles: [
    { id: "u-victor", nombre: "Víctor", email: "v@x.test", rol: "restaurante_user", empresa_id: 1 },
    { id: "u-pilar", nombre: "Pilar", email: "p@x.test", rol: "empresa_admin", empresa_id: 1 },
  ],
  usuario_marcas: [],
  usuario_restaurantes: [
    { user_id: "u-victor", restaurante_id: 1 },
    { user_id: "u-victor", restaurante_id: 3 },
  ],
  conv_conversaciones: [
    {
      id: "conv-victor",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T10:00:00Z",
      ultimo_mensaje_preview: "Hola",
      conv_contactos: { telefono_e164: "+34600000001", nombre: "Víctor", nombre_perfil: null, usuario_id: "u-victor" },
    },
    {
      id: "conv-pilar",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T09:00:00Z",
      ultimo_mensaje_preview: null,
      conv_contactos: { telefono_e164: "+34600000002", nombre: "Pilar", nombre_perfil: null, usuario_id: "u-pilar" },
    },
    {
      id: "conv-desconocido",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T08:00:00Z",
      ultimo_mensaje_preview: "¿Quién eres?",
      conv_contactos: { telefono_e164: "+34600000003", nombre: null, nombre_perfil: "Desconocido", usuario_id: null },
    },
  ],
});

const { listConversations } = await import("@/lib/conversations/read.server");

describe("distintivo de acceso en la bandeja", () => {
  it("vinculado: rol y nº de restaurantes efectivos; sin vincular: sin acceso a datos", async () => {
    const list = await listConversations();
    const byId = Object.fromEntries(list.map((item) => [item.id, item]));

    expect(byId["conv-victor"]!.access).toEqual({ state: "linked", rol: "restaurante_user", restaurantCount: 2 });
    expect(byId["conv-pilar"]!.access).toEqual({ state: "linked", rol: "empresa_admin", restaurantCount: 3 });
    expect(byId["conv-desconocido"]!.access).toEqual({ state: "unlinked" });
  });

  it("no expone el usuario_id ni el teléfono ajeno a la lista: solo los campos de la interfaz", async () => {
    const [first] = await listConversations();
    const json = JSON.stringify(first);
    for (const hidden of ["usuario_id", "u-victor", "u-pilar", "raw_payload", "v@x.test"]) {
      expect(json).not.toContain(hidden);
    }
  });

  it("la interfaz distingue vinculado y 'Sin acceso a datos'", () => {
    const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");
    expect(view).toContain('item.access.state === "linked"');
    expect(view).toContain("Vinculado ·");
    expect(view).toContain("Sin acceso a datos");
    expect(view).toContain("+ Nuevo contacto");
  });
});
