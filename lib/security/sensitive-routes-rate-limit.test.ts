import { beforeEach, describe, expect, it, vi } from "vitest";
import { SENSITIVE_RATE_LIMITS, type SensitiveOperation } from "@/lib/security/rate-limits";
import type { AuthSession, UserRole } from "@/lib/auth/types";

/**
 * SEC-013 — límites de las operaciones sensibles. Se ejecutan las rutas REALES (con requireApiAuth real); solo se
 * simulan la sesión, la base de datos del contador y la operación sensible de cada ruta (WhatsApp, Supabase Auth,
 * Chromium, PDF...), que es lo que NO debe ejecutarse cuando se devuelve 429. Nada de esto envía ni genera nada real.
 */

const m = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  changeOwnPassword: vi.fn(),
  createManagedUser: vi.fn(),
  setManagedUserPassword: vi.fn(),
  setManagedUserAccess: vi.fn(),
  getManagedUserDetail: vi.fn(),
  createAgentControl: vi.fn(),
  updateAgentControl: vi.fn(),
  getAgentControlSnapshot: vi.fn(),
  buildAgentDailySummaryPreview: vi.fn(),
  createRestaurantFromNexo: vi.fn(),
  sendConversationOperation: vi.fn(),
  runManualDailyReportForConversation: vi.fn(),
  runManualNegativeAlertForConversation: vi.fn(),
  sendManualTestTemplate: vi.fn(),
  sendManualActivation: vi.fn(),
  sendConversationReport: vi.fn(),
  updateConversationContact: vi.fn(),
  deleteConversationContact: vi.fn(),
  setConversationContactUser: vi.fn(),
  getConversationContactDetail: vi.fn(),
  setConversationNegativeAlerts: vi.fn(),
  createManualContact: vi.fn(),
  renderViaInternal: vi.fn(),
  loadMonthlyReport: vi.fn(),
  buildPdfResponse: vi.fn(),
  findReportById: vi.fn(),
}));

// Contador (SEC-006): una base de datos falsa que cuenta por cubo y recuerda qué cubos y límites se pidieron.
const counts = new Map<string, number>();
const rpcCalls: { bucket: string; limit: number; windowSeconds: number }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: m.getAuthSession }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: m.getUser, signOut: m.signOut } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (_fn: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => {
      rpcCalls.push({ bucket: args.p_bucket, limit: args.p_limit, windowSeconds: args.p_window_seconds });
      const hits = (counts.get(args.p_bucket) ?? 0) + 1;
      counts.set(args.p_bucket, hits);
      return { data: [{ allowed: hits <= args.p_limit, current_hits: hits, retry_after_seconds: 17 }], error: null };
    },
  }),
}));

vi.mock("@/lib/auth/user-creation.server", () => ({
  changeOwnPassword: m.changeOwnPassword,
  createManagedUser: m.createManagedUser,
  setManagedUserPassword: m.setManagedUserPassword,
}));
vi.mock("@/lib/auth/user-access.server", () => ({
  UserAccessError: class UserAccessError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  },
  listManagedUsers: vi.fn(),
  getManagedUserDetail: m.getManagedUserDetail,
  setManagedUserAccess: m.setManagedUserAccess,
  getUserFormOptions: vi.fn(),
}));
vi.mock("@/lib/agents/control", () => ({
  createAgentControl: m.createAgentControl,
  updateAgentControl: m.updateAgentControl,
  getAgentControlSnapshot: m.getAgentControlSnapshot,
}));
vi.mock("@/lib/agents/daily-summary", () => ({ buildAgentDailySummaryPreview: m.buildAgentDailySummaryPreview }));
vi.mock("@/lib/restaurants/onboarding", () => ({ createRestaurantFromNexo: m.createRestaurantFromNexo }));

vi.mock("@/lib/conversations/outbound.server", () => ({ outboundRepository: {} }));
vi.mock("@/lib/conversations/read.server", () => ({ getConversationMessages: vi.fn(), listConversations: vi.fn() }));
vi.mock("@/lib/whatsapp/cloud-api.server", () => ({
  isWhatsAppSenderConfigured: () => true,
  sendDocumentMessage: vi.fn(),
  sendImageMessage: vi.fn(),
  sendTextMessage: vi.fn(),
  uploadMedia: vi.fn(),
}));
vi.mock("@/lib/conversations/send-text", async () => {
  const actual = await vi.importActual<typeof import("@/lib/conversations/send-text")>("@/lib/conversations/send-text");
  return { ...actual, sendConversationOperation: m.sendConversationOperation };
});
vi.mock("@/lib/conversations/contact-activation.server", () => ({
  sendManualTestTemplate: m.sendManualTestTemplate,
  sendManualActivation: m.sendManualActivation,
}));
vi.mock("@/lib/alerts/negative-review/process.server", () => ({ runManualNegativeAlertForConversation: m.runManualNegativeAlertForConversation }));
vi.mock("@/lib/reports/daily/process.server", () => ({ runManualDailyReportForConversation: m.runManualDailyReportForConversation }));
vi.mock("@/lib/conversations/report-delivery.server", () => ({ reportAdapters: () => ({}) }));
vi.mock("@/lib/conversations/report-send", () => ({ sendConversationReport: m.sendConversationReport }));
vi.mock("@/lib/conversations/report-catalog", () => ({
  parseSendReportBody: (body: { requestId: string }) => ({ ok: true, requestId: body.requestId, reportType: "x", format: "pdf" }),
}));
vi.mock("@/lib/conversations/contact-link.server", () => ({
  ContactError: class ContactError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  },
  updateConversationContact: m.updateConversationContact,
  deleteConversationContact: m.deleteConversationContact,
  setConversationContactUser: m.setConversationContactUser,
  getConversationContactDetail: m.getConversationContactDetail,
  setConversationNegativeAlerts: m.setConversationNegativeAlerts,
}));
vi.mock("@/lib/conversations/manual-contact.server", () => ({ createManualContact: m.createManualContact }));
vi.mock("@/lib/conversations/manual-contact", () => ({
  parseManualContactBody: () => ({ ok: true, nombre: "Ana", telefonoE164: "+34600000000", access: {} }),
}));

vi.mock("@/lib/render/internal-render-client", () => ({ renderViaInternal: m.renderViaInternal }));
vi.mock("@/lib/reports/monthly/data", () => ({ loadMonthlyReport: m.loadMonthlyReport, listMonthlyRestaurants: vi.fn() }));
vi.mock("@/lib/reports/pdf-response", () => ({ buildPdfResponse: m.buildPdfResponse }));
vi.mock("@/lib/reports/find-report", () => ({ findReportById: m.findReportById }));

// Rutas reales
const routes = {
  changePassword: await import("@/app/api/auth/change-password/route"),
  usersCreate: await import("@/app/api/platform/users/route"),
  userAccess: await import("@/app/api/platform/users/[userId]/route"),
  userPassword: await import("@/app/api/platform/users/[userId]/password/route"),
  agentsCreate: await import("@/app/api/agents/create/route"),
  agentsUpdate: await import("@/app/api/agents/update/route"),
  agentsPreview: await import("@/app/api/agents/daily-summary/preview/route"),
  onboarding: await import("@/app/api/restaurants/onboarding/create/route"),
  messages: await import("@/app/api/conversations/[conversationId]/messages/route"),
  templateTest: await import("@/app/api/conversations/[conversationId]/template-test/route"),
  reportSend: await import("@/app/api/conversations/[conversationId]/reports/route"),
  activation: await import("@/app/api/conversations/[conversationId]/activation/route"),
  contact: await import("@/app/api/conversations/[conversationId]/contact/route"),
  contacts: await import("@/app/api/conversations/contacts/route"),
  negativeAlerts: await import("@/app/api/conversations/[conversationId]/negative-alerts/route"),
  networkImage: await import("@/app/api/generate-network-summary-image/route"),
  monthlyPdf: await import("@/app/api/informes/mensual/[id]/route"),
  monthlyImage: await import("@/app/api/informes/mensual/[id]/imagen/route"),
  reportPdfPost: await import("@/app/api/reports/pdf/route"),
  reportPdfGet: await import("@/app/api/reports/pdf/[id]/route"),
};

const UUID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_CONVERSATION = "33333333-3333-4333-8333-333333333333";

function session(userId: string, rol: UserRole): AuthSession {
  return {
    userId,
    email: "u@example.com",
    perfil: { id: userId, userId, rol, nombre: null, email: null, empresaId: "1", mustChangePassword: false },
    scope: { rol, empresaId: "1", empresaNombre: null, marcaIds: null, restauranteIds: null, brandIds: null },
    assignedRestaurants: [],
    companies: [],
    activeCompany: null,
  } as unknown as AuthSession;
}

type CallOptions = { garbage?: boolean; target?: string };

const req = (path: string, method: string, body?: unknown, garbage = false) =>
  new Request(`https://nexo.example${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "GET" || method === "DELETE" ? {} : { body: garbage ? "{esto no es json" : JSON.stringify(body ?? {}) }),
  });
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

type Case = {
  name: string;
  operation: SensitiveOperation;
  /** Qué responde la ruta sin sesión (la de antes: algunas dan 401 y otras 403). */
  noSession: number;
  /** ¿Cualquier rol autenticado puede usarla? (cambio de contraseña propia). */
  anyRole?: boolean;
  /** Operación sensible que NO debe ejecutarse con un 429. */
  spy: () => ReturnType<typeof vi.fn>;
  call: (o?: CallOptions) => Promise<Response>;
};

const cases: Case[] = [
  {
    name: "POST /api/auth/change-password",
    operation: "auth-change-password",
    noSession: 401,
    anyRole: true,
    spy: () => m.changeOwnPassword,
    call: (o) => routes.changePassword.POST(req("/api/auth/change-password", "POST", { password: "Segura-12345" }, o?.garbage)),
  },
  {
    name: "POST /api/platform/users",
    operation: "platform-user-create",
    noSession: 401,
    spy: () => m.createManagedUser,
    call: (o) => routes.usersCreate.POST(req("/api/platform/users", "POST", { email: o?.target ?? "x@example.com" }, o?.garbage)),
  },
  {
    name: "PUT /api/platform/users/[userId]",
    operation: "platform-user-access",
    noSession: 401,
    spy: () => m.setManagedUserAccess,
    call: (o) => routes.userAccess.PUT(req(`/api/platform/users/${o?.target ?? TARGET_USER}`, "PUT", { rol: "empresa_admin" }, o?.garbage), ctx({ userId: o?.target ?? TARGET_USER })),
  },
  {
    name: "POST /api/platform/users/[userId]/password",
    operation: "platform-user-password",
    noSession: 401,
    spy: () => m.setManagedUserPassword,
    call: (o) =>
      routes.userPassword.POST(req(`/api/platform/users/${o?.target ?? TARGET_USER}/password`, "POST", { password: "Otra-12345" }, o?.garbage), ctx({ userId: o?.target ?? TARGET_USER })),
  },
  {
    name: "POST /api/agents/create",
    operation: "agents-create",
    noSession: 403,
    spy: () => m.createAgentControl,
    call: (o) => routes.agentsCreate.POST(req("/api/agents/create", "POST", { nombre: "A" }, o?.garbage)),
  },
  {
    name: "POST /api/agents/update",
    operation: "agents-update",
    noSession: 403,
    spy: () => m.updateAgentControl,
    call: (o) => routes.agentsUpdate.POST(req("/api/agents/update", "POST", { id: o?.target ?? "agent-1" }, o?.garbage)),
  },
  {
    name: "POST /api/agents/daily-summary/preview",
    operation: "agents-summary-preview",
    noSession: 403,
    spy: () => m.buildAgentDailySummaryPreview,
    call: (o) => routes.agentsPreview.POST(req("/api/agents/daily-summary/preview", "POST", { agentId: o?.target ?? "agent-1" }, o?.garbage)),
  },
  {
    name: "POST /api/restaurants/onboarding/create",
    operation: "restaurant-onboarding-create",
    noSession: 403,
    spy: () => m.createRestaurantFromNexo,
    call: (o) => routes.onboarding.POST(req("/api/restaurants/onboarding/create", "POST", { nombre: "Local" }, o?.garbage)),
  },
  {
    name: "POST /api/conversations/[conversationId]/messages",
    operation: "conversation-send",
    noSession: 401,
    spy: () => m.sendConversationOperation,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.messages.POST(req(`/api/conversations/${id}/messages`, "POST", { text: "Hola", requestId: UUID }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "POST /api/conversations/[conversationId]/template-test",
    operation: "conversation-template-test",
    noSession: 401,
    spy: () => m.runManualDailyReportForConversation,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.templateTest.POST(req(`/api/conversations/${id}/template-test`, "POST", { kind: "daily_report", requestId: UUID }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "POST /api/conversations/[conversationId]/reports",
    operation: "conversation-report-send",
    noSession: 401,
    spy: () => m.sendConversationReport,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.reportSend.POST(req(`/api/conversations/${id}/reports`, "POST", { requestId: UUID }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "POST /api/conversations/[conversationId]/activation",
    operation: "conversation-activation",
    noSession: 401,
    spy: () => m.sendManualActivation,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.activation.POST(req(`/api/conversations/${id}/activation`, "POST"), ctx({ conversationId: id }));
    },
  },
  {
    name: "PATCH /api/conversations/[conversationId]/contact",
    operation: "conversation-contact-update",
    noSession: 401,
    spy: () => m.updateConversationContact,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.contact.PATCH(req(`/api/conversations/${id}/contact`, "PATCH", { nombre: "N" }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "PUT /api/conversations/[conversationId]/contact",
    operation: "conversation-contact-update",
    noSession: 401,
    spy: () => m.setConversationContactUser,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.contact.PUT(req(`/api/conversations/${id}/contact`, "PUT", { usuarioId: null }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "DELETE /api/conversations/[conversationId]/contact",
    operation: "conversation-contact-delete",
    noSession: 401,
    spy: () => m.deleteConversationContact,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.contact.DELETE(req(`/api/conversations/${id}/contact`, "DELETE"), ctx({ conversationId: id }));
    },
  },
  {
    name: "POST /api/conversations/contacts",
    operation: "conversation-contact-create",
    noSession: 401,
    spy: () => m.createManualContact,
    call: (o) => routes.contacts.POST(req("/api/conversations/contacts", "POST", { nombre: o?.target ?? "Ana" }, o?.garbage)),
  },
  {
    name: "PUT /api/conversations/[conversationId]/negative-alerts",
    operation: "conversation-negative-alerts",
    noSession: 401,
    spy: () => m.setConversationNegativeAlerts,
    call: (o) => {
      const id = o?.target ?? UUID;
      return routes.negativeAlerts.PUT(req(`/api/conversations/${id}/negative-alerts`, "PUT", { enabled: true }, o?.garbage), ctx({ conversationId: id }));
    },
  },
  {
    name: "GET /api/generate-network-summary-image",
    operation: "network-summary-image",
    noSession: 401,
    spy: () => m.renderViaInternal,
    call: (o) => routes.networkImage.GET(req(o?.garbage ? "/api/generate-network-summary-image?periodo=zzz&grupo=zzz" : "/api/generate-network-summary-image?periodo=semanal&grupo=bk&offset=0", "GET")),
  },
  {
    name: "GET /api/informes/mensual/[id] (PDF)",
    operation: "monthly-report-render",
    noSession: 401,
    spy: () => m.renderViaInternal,
    call: (o) => routes.monthlyPdf.GET(req(`/api/informes/mensual/${o?.garbage ? "x" : "7"}?offset=0`, "GET"), ctx({ id: o?.garbage ? "x" : "7" })),
  },
  {
    name: "GET /api/informes/mensual/[id]/imagen",
    operation: "monthly-report-render",
    noSession: 401,
    spy: () => m.renderViaInternal,
    call: (o) => routes.monthlyImage.GET(req(`/api/informes/mensual/${o?.garbage ? "x" : "7"}/imagen?offset=0`, "GET"), ctx({ id: o?.garbage ? "x" : "7" })),
  },
  {
    name: "POST /api/reports/pdf",
    operation: "report-pdf",
    noSession: 401,
    spy: () => m.buildPdfResponse,
    call: (o) => routes.reportPdfPost.POST(req("/api/reports/pdf", "POST", { id: "r1", date: "2026-01-01" }, o?.garbage)),
  },
  {
    name: "GET /api/reports/pdf/[id]",
    operation: "report-pdf",
    noSession: 401,
    spy: () => m.buildPdfResponse,
    call: (o) => routes.reportPdfGet.GET(req(`/api/reports/pdf/${o?.target ?? "report-bk-2026-01-01"}`, "GET"), ctx({ id: o?.target ?? "report-bk-2026-01-01" })),
  },
];

const identify = (userId: string | null, rol: UserRole = "super_admin") => {
  m.getAuthSession.mockResolvedValue(userId ? session(userId, rol) : null);
  m.getUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
};
const saturate = (operation: SensitiveOperation, userId: string) =>
  counts.set(`${operation}:${userId}`, SENSITIVE_RATE_LIMITS[operation].limit);

beforeEach(() => {
  vi.resetAllMocks();
  counts.clear();
  rpcCalls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  identify("admin-A");
  m.signOut.mockResolvedValue({ error: null });
  m.changeOwnPassword.mockResolvedValue(undefined);
  m.createManagedUser.mockResolvedValue({ userId: "nuevo" });
  m.setManagedUserPassword.mockResolvedValue(undefined);
  m.setManagedUserAccess.mockResolvedValue(undefined);
  m.getManagedUserDetail.mockResolvedValue({ user: {} });
  m.createAgentControl.mockResolvedValue(undefined);
  m.updateAgentControl.mockResolvedValue(undefined);
  m.getAgentControlSnapshot.mockResolvedValue({ agents: [] });
  m.buildAgentDailySummaryPreview.mockResolvedValue({ message: "x" });
  m.createRestaurantFromNexo.mockResolvedValue({ id: 1 });
  m.sendConversationOperation.mockResolvedValue({ status: "sent", messages: [], sent: [], deduplicated: false });
  m.runManualDailyReportForConversation.mockResolvedValue({ status: "contact_not_found" });
  m.sendManualActivation.mockResolvedValue({ status: "contact_not_found" });
  m.sendConversationReport.mockResolvedValue({ status: "sent", messages: [], sent: [], deduplicated: false });
  m.updateConversationContact.mockResolvedValue({ contacto: {} });
  m.deleteConversationContact.mockResolvedValue("deleted");
  m.setConversationContactUser.mockResolvedValue("linked");
  m.getConversationContactDetail.mockResolvedValue({ contacto: {} });
  m.setConversationNegativeAlerts.mockResolvedValue(true);
  m.createManualContact.mockResolvedValue({ status: "created", conversationId: "c1" });
  m.renderViaInternal.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  m.loadMonthlyReport.mockResolvedValue({ restaurant: { name: "BK Utebo" }, startKey: "2026-01-01" });
  m.buildPdfResponse.mockResolvedValue(new Response("%PDF", { status: 200 }));
  m.findReportById.mockResolvedValue({ id: "r1" });
});

describe.each(cases)("$name", (route) => {
  const { limit, windowSeconds } = SENSITIVE_RATE_LIMITS[route.operation];

  it("sin sesión → el mismo estado de siempre, y no gasta cupo ni ejecuta nada", async () => {
    identify(null);
    expect((await route.call()).status).toBe(route.noSession);
    expect(rpcCalls).toHaveLength(0);
    expect(route.spy()).not.toHaveBeenCalled();
  });

  it.skipIf(route.anyRole)("rol no autorizado → 403 como antes, sin gastar cupo ni ejecutar nada", async () => {
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"] as UserRole[]) {
      identify("user-X", rol);
      expect((await route.call()).status, rol).toBe(403);
    }
    expect(rpcCalls).toHaveLength(0);
    expect(route.spy()).not.toHaveBeenCalled();
  });

  it("usuario autorizado dentro del límite → la operación se ejecuta", async () => {
    const res = await route.call();
    expect(res.status).not.toBe(429);
    expect(route.spy()).toHaveBeenCalled();
  });

  it(`límite superado (${limit} / ${windowSeconds}s) → 429 con Retry-After y la operación NO se ejecuta`, async () => {
    saturate(route.operation, "admin-A");
    const res = await route.call();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("17");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." });
    expect(route.spy()).not.toHaveBeenCalled();
  });

  it("el límite va ANTES de leer el cuerpo o los parámetros (basura + cupo agotado → 429, no 400)", async () => {
    saturate(route.operation, "admin-A");
    expect((await route.call({ garbage: true })).status).toBe(429);
    expect(route.spy()).not.toHaveBeenCalled();
  });

  it("el usuario A no consume el cupo del usuario B", async () => {
    saturate(route.operation, "admin-A");
    expect((await route.call()).status).toBe(429);

    identify("admin-B");
    expect((await route.call()).status).not.toBe(429);
    expect(route.spy()).toHaveBeenCalled();
  });

  it("la clave es <operación>:<usuario autenticado>, con el límite y la ventana de la tabla, sin importar parámetros ni cuerpo", async () => {
    await route.call();
    await route.call({ target: OTHER_CONVERSATION });
    await route.call({ target: "otro-objetivo" });
    expect(rpcCalls.length).toBeGreaterThan(0);
    for (const call of rpcCalls) {
      expect(call).toEqual({ bucket: `${route.operation}:admin-A`, limit, windowSeconds });
    }
  });
});

describe("cupos compartidos y globales", () => {
  it("Conversations: cambiar de conversación NO da un cupo nuevo (el cubo es global del usuario)", async () => {
    const send = cases.find((c) => c.operation === "conversation-send")!;
    saturate("conversation-send", "admin-A");
    for (const target of [UUID, OTHER_CONVERSATION, "44444444-4444-4444-8444-444444444444"]) {
      expect((await send.call({ target })).status).toBe(429);
    }
    expect(m.sendConversationOperation).not.toHaveBeenCalled();
  });

  it("Conversations: la idempotencia sigue funcionando (el mismo requestId se envía a la operación tal cual)", async () => {
    const send = cases.find((c) => c.operation === "conversation-send")!;
    m.sendConversationOperation.mockResolvedValue({ status: "sent", messages: [], sent: [], deduplicated: true });
    const res = await send.call();
    expect(await res.json()).toMatchObject({ deduplicated: true });
    expect(m.sendConversationOperation.mock.calls[0]![0]).toMatchObject({ requestId: UUID });
  });

  it("administración de usuarios: el usuario OBJETIVO no cambia el cubo del super_admin", async () => {
    const access = cases.find((c) => c.operation === "platform-user-access")!;
    for (const target of [TARGET_USER, "55555555-5555-4555-8555-555555555555"]) await access.call({ target });
    expect(new Set(rpcCalls.map((c) => c.bucket))).toEqual(new Set(["platform-user-access:admin-A"]));
  });

  it("PATCH y PUT del contacto comparten cupo; borrar tiene el suyo", async () => {
    const patch = cases.find((c) => c.name.startsWith("PATCH"))!;
    const put = cases.find((c) => c.name.startsWith("PUT /api/conversations/[conversationId]/contact"))!;
    const del = cases.find((c) => c.name.startsWith("DELETE"))!;
    saturate("conversation-contact-update", "admin-A");
    expect((await patch.call()).status).toBe(429);
    expect((await put.call()).status).toBe(429);
    expect((await del.call()).status).not.toBe(429);
  });

  it("los dos informes mensuales (PDF e imagen) comparten cupo de renderizado", async () => {
    const pdf = cases.find((c) => c.name.includes("(PDF)"))!;
    const image = cases.find((c) => c.name.includes("/imagen"))!;
    saturate("monthly-report-render", "admin-A");
    expect((await pdf.call()).status).toBe(429);
    expect((await image.call()).status).toBe(429);
    expect(m.renderViaInternal).not.toHaveBeenCalled();
    expect(m.loadMonthlyReport).not.toHaveBeenCalled();
  });

  it("un 429 llega antes de cualquier trabajo: contraseña, alta de usuario/restaurante, WhatsApp, Chromium y PDF", async () => {
    const dangerous = ["auth-change-password", "platform-user-create", "restaurant-onboarding-create", "conversation-send", "conversation-template-test", "conversation-activation", "network-summary-image", "report-pdf"] as SensitiveOperation[];
    for (const operation of dangerous) saturate(operation, "admin-A");
    for (const route of cases.filter((c) => dangerous.includes(c.operation))) expect((await route.call()).status, route.name).toBe(429);
    for (const spy of [m.changeOwnPassword, m.createManagedUser, m.createRestaurantFromNexo, m.sendConversationOperation, m.runManualDailyReportForConversation, m.sendManualActivation, m.renderViaInternal, m.buildPdfResponse]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("el contador de Postgres falla → no se cae Nexo (respaldo en memoria de SEC-006)", () => {
  it("con el limitador roto la operación sigue funcionando", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      getSupabaseAdmin: () => ({ rpc: async () => ({ data: null, error: { code: "42883" } }) }),
    }));
    const { rateLimitAuthenticatedUser } = await import("@/lib/security/rate-limit.server");
    expect(await rateLimitAuthenticatedUser("conversation-send", "admin-A")).toBeNull();
    vi.doUnmock("@/lib/supabase/admin");
  });
});
