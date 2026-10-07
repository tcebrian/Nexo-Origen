import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/conversations/fake-supabase.test-helper";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));

const db = createFakeDb({
  restaurantes: [
    { id: 1, empresa_id: 1, marca_id: 10 },
    { id: 2, empresa_id: 1, marca_id: 10 },
    { id: 3, empresa_id: 1, marca_id: 10 },
    { id: 4, empresa_id: 1, marca_id: 20 },
  ],
  conv_contacto_empresas: [
    { contacto_id: "c-victor", empresa_id: 1, todos_restaurantes: false },
    { contacto_id: "c-direccion", empresa_id: 1, todos_restaurantes: true },
  ],
  conv_contacto_restaurantes: [
    { contacto_id: "c-victor", empresa_id: 1, restaurante_id: 1 },
    { contacto_id: "c-victor", empresa_id: 1, restaurante_id: 4 },
  ],
  conv_conversaciones: [
    {
      id: "conv-victor",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T10:00:00Z",
      ultimo_mensaje_preview: "Hola",
      conv_contactos: { id: "c-victor", telefono_e164: "+34600000001", nombre: "Víctor", nombre_perfil: null, tipo: "supervisor" },
    },
    {
      id: "conv-direccion",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T09:00:00Z",
      ultimo_mensaje_preview: null,
      conv_contactos: { id: "c-direccion", telefono_e164: "+34600000002", nombre: "Pilar", nombre_perfil: null, tipo: "direccion" },
    },
    {
      id: "conv-desconocido",
      estado: "open",
      ultimo_mensaje_at: "2026-10-08T08:00:00Z",
      ultimo_mensaje_preview: "¿Quién eres?",
      conv_contactos: { id: "c-desconocido", telefono_e164: "+34600000003", nombre: null, nombre_perfil: "Desconocido", tipo: null },
    },
  ],
});

const { listConversations } = await import("@/lib/conversations/read.server");

describe("distintivo de acceso en la bandeja", () => {
  it("autorizado: nº de restaurantes del propio contacto; sin permisos: sin acceso a datos", async () => {
    const list = await listConversations();
    const byId = Object.fromEntries(list.map((item) => [item.id, item]));

    expect(byId["conv-victor"]!.access).toEqual({ state: "granted", restaurantCount: 2, tipo: "supervisor" });
    expect(byId["conv-direccion"]!.access).toEqual({ state: "granted", restaurantCount: 4, tipo: "direccion" });
    expect(byId["conv-desconocido"]!.access).toEqual({ state: "none" });
  });

  it("no expone ids de contacto, cuentas web ni datos internos", async () => {
    const json = JSON.stringify(await listConversations());
    for (const hidden of ["c-victor", "usuario_id", "raw_payload", "contacto_id"]) expect(json).not.toContain(hidden);
  });

  it("la interfaz distingue autorizado y 'Sin acceso a datos', y no muestra roles web en la bandeja", () => {
    const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");
    expect(view).toContain('item.access.state === "granted"');
    expect(view).toContain("Autorizado ·");
    expect(view).toContain("Sin acceso a datos");
    expect(view).toContain("+ Nuevo contacto");
    const row = view.slice(view.indexOf("function ConversationRow"), view.indexOf("function MessageBubble"));
    expect(row).not.toMatch(/restaurante_user|empresa_admin|WEB_ACCOUNT_LABELS/);
  });
});
