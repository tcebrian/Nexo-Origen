import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resolveRestaurantIds, type ContactGrants } from "@/lib/conversations/contact-access";
import { processNegativeReviewAlert, type AlertReview, type NegativeAlertDeps } from "./orchestrator";
import { selectAlertRecipients, type AlertContactRow } from "./recipients";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

// Catálogo: empresa 1 tiene los restaurantes 10, 11 y 12; empresa 2 tiene el 20.
const catalog = [
  { id: 10, empresaId: 1 },
  { id: 11, empresaId: 1 },
  { id: 12, empresaId: 1 },
  { id: 20, empresaId: 2 },
];

const grants: Record<string, ContactGrants> = {
  // Restaurante 10 asignado explícitamente.
  "c-asignado": { empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: [{ empresaId: 1, restauranteId: 10 }] },
  // Otro restaurante de la misma empresa (NO el 10).
  "c-otro-local": { empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: [{ empresaId: 1, restauranteId: 11 }] },
  // Todos los restaurantes de la empresa 1, actuales y futuros.
  "c-todos": { empresas: [{ empresaId: 1, todosRestaurantes: true }], restaurantes: [] },
  // Sin empresa ni asignaciones.
  "c-sin-permisos": { empresas: [], restaurantes: [] },
  // Con permisos pero el interruptor apagado.
  "c-apagado": { empresas: [{ empresaId: 1, todosRestaurantes: false }], restaurantes: [{ empresaId: 1, restauranteId: 10 }] },
  "c-apagado-todos": { empresas: [{ empresaId: 1, todosRestaurantes: true }], restaurantes: [] },
};

const enabled = new Set(["c-asignado", "c-otro-local", "c-todos", "c-sin-permisos"]);
const contacts: AlertContactRow[] = Object.keys(grants).map((id) => ({ id, name: id, activated: true, alertsEnabled: enabled.has(id) }));

function accessOf(restaurants = catalog): Map<string, number[]> {
  return new Map(Object.entries(grants).map(([id, grant]) => [id, resolveRestaurantIds(grant, restaurants)]));
}

const idsFor = (restaurantId: number, restaurants = catalog) =>
  selectAlertRecipients({ restaurantId, contacts, access: accessOf(restaurants) }).map((recipient) => recipient.contactId);

describe("destinatarios de la alerta negativa: interruptor + acceso", () => {
  it("interruptor desactivado → no recibe, aunque tenga acceso (también con 'todos')", () => {
    const ids = idsFor(10);
    expect(ids).not.toContain("c-apagado");
    expect(ids).not.toContain("c-apagado-todos");
  });

  it("interruptor activado + restaurante permitido → recibe", () => {
    expect(idsFor(10)).toContain("c-asignado");
  });

  it("interruptor activado + restaurante NO permitido → no recibe", () => {
    const ids = idsFor(10);
    expect(ids).not.toContain("c-otro-local"); // su permiso es el restaurante 11
    expect(idsFor(20)).toEqual([]); // restaurante de otra empresa: nadie lo tiene
    expect(idsFor(11)).toEqual(["c-otro-local", "c-todos"]);
  });

  it("todos_restaurantes=true → recibe de todos los restaurantes de esa empresa, también de los nuevos", () => {
    expect(idsFor(10)).toContain("c-todos");
    expect(idsFor(12)).toEqual(["c-todos"]);
    // Se abre un restaurante nuevo en la empresa 1: entra solo, sin tocar nada.
    const withNew = [...catalog, { id: 13, empresaId: 1 }];
    expect(idsFor(13, withNew)).toEqual(["c-todos"]);
    // …pero no recibe los de otra empresa.
    expect(idsFor(20)).not.toContain("c-todos");
  });

  it("sin empresa ni asignaciones → no recibe nada, aunque el interruptor esté activado (el interruptor no da acceso)", () => {
    for (const restaurantId of [10, 11, 12, 20]) expect(idsFor(restaurantId)).not.toContain("c-sin-permisos");
  });

  it("un contacto sin entrada de permisos tampoco recibe (deny by default)", () => {
    const ghost: AlertContactRow = { id: "c-fantasma", name: null, activated: true, alertsEnabled: true };
    expect(selectAlertRecipients({ restaurantId: 10, contacts: [ghost], access: new Map() })).toEqual([]);
  });
});

describe("el interruptor manda sobre el flujo de la alerta", () => {
  const review: AlertReview = { resenaId: 501, restauranteId: 10, stars: 1, restaurantName: "Burger King Soria" };

  function run(accessible: AlertContactRow[]) {
    const reserved: string[] = [];
    const deps: NegativeAlertDeps = {
      now: () => new Date("2026-10-17T10:00:00Z"),
      loadReview: async () => review,
      findRecipients: async () => selectAlertRecipients({ restaurantId: 10, contacts: accessible, access: accessOf() }),
      async reserve({ contactId }) {
        reserved.push(contactId);
        return { id: `alert-${contactId}` };
      },
      update: async () => undefined,
      conversationFor: async (contactId) => `conv-${contactId}`,
      isWindowOpen: async () => true,
      countOutstanding: async () => 1,
      deliverContent: vi.fn(async () => ({ status: "sent" as const })),
      sendTemplate: vi.fn(async () => ({ status: "sent" as const, wamid: "wamid.T" })),
    };
    return { deps, reserved, done: processNegativeReviewAlert({ resenaId: 501 }, deps) };
  }

  it("apagado: no se reserva alerta (ni pendiente), ni plantilla ni contenido", async () => {
    const t = run(contacts.filter((contact) => contact.id === "c-apagado"));
    expect(await t.done).toMatchObject({ status: "processed", recipients: 0, outcomes: [] });
    expect(t.reserved).toEqual([]);
    expect(t.deps.deliverContent).not.toHaveBeenCalled();
    expect(t.deps.sendTemplate).not.toHaveBeenCalled();
  });

  it("activado + permitido: el flujo de siempre (envío directo con la ventana abierta)", async () => {
    const t = run(contacts.filter((contact) => contact.id === "c-asignado"));
    expect(await t.done).toMatchObject({ outcomes: [{ contactId: "c-asignado", outcome: "delivered_direct" }] });
    expect(t.reserved).toEqual(["c-asignado"]);
  });

  it.each([1, 2, 3])("%i★ con toggle activo y restaurante permitido → recibe; toggle apagado o restaurante ajeno → no", async (stars) => {
    const reviewOf = (restauranteId: number): AlertReview => ({ ...review, restauranteId, stars });
    const outcomesFor = async (restauranteId: number, rows: AlertContactRow[]) => {
      const reserved: string[] = [];
      const deps: NegativeAlertDeps = {
        loadReview: async () => reviewOf(restauranteId),
        findRecipients: async () => selectAlertRecipients({ restaurantId: restauranteId, contacts: rows, access: accessOf() }),
        async reserve({ contactId }) {
          reserved.push(contactId);
          return { id: `a-${contactId}` };
        },
        update: async () => undefined,
        conversationFor: async (contactId) => `conv-${contactId}`,
        isWindowOpen: async () => true,
        countOutstanding: async () => 1,
        deliverContent: vi.fn(async () => ({ status: "sent" as const })),
        sendTemplate: vi.fn(async () => ({ status: "sent" as const, wamid: null })),
      };
      await processNegativeReviewAlert({ resenaId: 501 }, deps);
      return reserved;
    };
    const byId = (...ids: string[]) => contacts.filter((contact) => ids.includes(contact.id));

    expect(await outcomesFor(10, byId("c-asignado"))).toEqual(["c-asignado"]);
    expect(await outcomesFor(10, byId("c-apagado", "c-apagado-todos"))).toEqual([]); // toggle apagado
    expect(await outcomesFor(10, byId("c-otro-local"))).toEqual([]); // restaurante no permitido
  });

  it("activado pero no activado en WhatsApp: sigue quedando pendiente, como antes", async () => {
    const t = run([{ id: "c-asignado", name: null, activated: false, alertsEnabled: true }]);
    expect(await t.done).toMatchObject({ outcomes: [{ outcome: "pending_not_activated" }] });
  });
});

describe("el interruptor no toca nada más (informe diario, permisos, bot)", () => {
  const COLUMN = "recibir_alertas_negativas";

  it("ni el informe diario ni la resolución de permisos leen el interruptor", () => {
    for (const file of [
      "lib/reports/daily/job.ts",
      "lib/reports/daily/process.server.ts",
      "lib/reports/daily/manual-test.ts",
      "lib/reports/daily/view.ts",
      "lib/conversations/contact-access.ts",
      "lib/conversations/contact-scope.server.ts",
    ]) {
      expect(read(file), file).not.toContain(COLUMN);
    }
  });

  it("el informe diario sigue eligiendo a los contactos activados, sin mirar el interruptor", () => {
    const daily = read("lib/reports/daily/process.server.ts");
    expect(daily).toContain('.not("whatsapp_activated_at", "is", null)');
    expect(daily).toContain("resolveContactsRestaurantIds(contactIds)");
  });

  it("la selección de alertas exige el interruptor en la consulta y en la función pura", () => {
    const alerts = read("lib/alerts/negative-review/process.server.ts");
    expect(alerts).toContain('.eq("recibir_alertas_negativas", true)');
    expect(alerts).toContain("selectAlertRecipients(");
    // Los candidatos siguen saliendo SOLO de las tablas de permisos del contacto.
    expect(alerts).toContain("conv_contacto_empresas");
    expect(alerts).toContain("conv_contacto_restaurantes");
  });
});

// Ruta del interruptor -----------------------------------------------------------------------------
const requireApiAuth = vi.fn();
const setConversationNegativeAlerts = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/conversations/contact-link.server", () => ({ setConversationNegativeAlerts }));

const route = await import("@/app/api/conversations/[conversationId]/negative-alerts/route");
const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
const put = (body: unknown, id = CONVERSATION_ID) =>
  route.PUT(
    new Request(`https://nexo.example/api/conversations/${id}/negative-alerts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ conversationId: id }) }
  );

describe("PUT /api/conversations/[id]/negative-alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asRole("super_admin");
    setConversationNegativeAlerts.mockResolvedValue(true);
  });

  it("solo super_admin", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await put({ enabled: true })).status).toBe(401);
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      asRole(rol);
      expect((await put({ enabled: true })).status).toBe(403);
    }
    expect(setConversationNegativeAlerts).not.toHaveBeenCalled();
  });

  it("solo acepta un booleano y solo escribe ese valor (nada de permisos ni teléfonos)", async () => {
    for (const bad of [{}, { enabled: "true" }, { enabled: 1 }, null]) expect((await put(bad)).status).toBe(400);
    expect((await put({ enabled: true }, "nope")).status).toBe(400);
    expect(setConversationNegativeAlerts).not.toHaveBeenCalled();

    const on = await put({ enabled: true, empresaId: 9, restaurantIds: [1], todosRestaurantes: true });
    expect(on.status).toBe(200);
    expect(await on.json()).toEqual({ enabled: true });
    expect(setConversationNegativeAlerts).toHaveBeenCalledWith(CONVERSATION_ID, true);

    await put({ enabled: false });
    expect(setConversationNegativeAlerts).toHaveBeenLastCalledWith(CONVERSATION_ID, false);
  });

  it("conversación inexistente → 404", async () => {
    setConversationNegativeAlerts.mockResolvedValue(false);
    expect((await put({ enabled: true })).status).toBe(404);
  });
});

describe("interfaz del interruptor", () => {
  const panel = read("app/dashboard/conversaciones/_components/contact-info-panel.tsx");

  it("tarjeta 'Reseñas negativas' con su descripción, estados Activado/Desactivado y un switch accesible", () => {
    expect(panel).toContain('title="Reseñas negativas"');
    expect(panel).toContain("Recibir automáticamente por WhatsApp las reseñas de 1⭐, 2⭐ y 3⭐ de sus restaurantes.");
    expect(panel).not.toContain("1⭐ y 2⭐");
    expect(panel).toContain('"Activado" : "Desactivado"');
    expect(panel).toContain('role="switch"');
    expect(panel).toContain("/negative-alerts");
    expect(panel).toContain("enabled={detail.negativeAlerts}");
  });
});
