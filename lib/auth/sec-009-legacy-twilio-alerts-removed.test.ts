import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isProtectedApiPath } from "@/lib/auth/route-guard";

/**
 * SEC-009 — el sistema ANTIGUO de alertas negativas por imagen/Twilio se ha eliminado (webhook de reseñas, ruta de
 * la imagen con el secreto en la URL, envío con imagen, tabla antigua y destinatarios en código). El fallback de
 * TEXTO de los agentes (`sendWhatsAppText`) y los webhooks actuales NO se tocan. Los literales se construyen por
 * partes para que este fichero no los contenga enteros.
 */

const create = vi.fn();
vi.mock("twilio", () => ({ default: vi.fn(() => ({ messages: { create } })) }));

const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp");

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const OLD_WEBHOOK = ["new-resena", "whatsapp"].join("-");
const OLD_IMAGE_ROUTE = ["whatsapp-alert", "image"].join("-");
const OLD_SENDER = ["sendWhatsApp", "ImageAlert"].join("");
const OLD_TABLE = ["whatsapp_alertas", "enviadas"].join("_");
const OLD_RECIPIENTS = ["EMPRESA", "RECIPIENTS"].join("_");
const OLD_SECRET = ["WHATSAPP", "WEBHOOK", "SECRET"].join("_");
const PERSONAL_PHONE = ["688", "718", "820"].join("");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|mjs|json|sql)$/.test(entry) ? [full] : [];
  });
}

const ALL = ["app", "lib", "templates", "scripts", "supabase"]
  .map((dir) => join(ROOT, dir))
  .filter(existsSync)
  .flatMap(sourceFiles)
  .concat(["vercel.json", "middleware.ts", "next.config.ts"].map((f) => join(ROOT, f)).filter(existsSync))
  // Este propio fichero nombra lo eliminado en los títulos de los tests: se excluye del barrido.
  .filter((file) => !/sec-009-legacy-twilio-alerts-removed\.test\./.test(file));
const NON_TEST = ALL.filter((file) => !/\.test\./.test(file));
const withText = (files: string[], needle: string) => files.filter((file) => readFileSync(file, "utf8").includes(needle));

describe("SEC-009 las rutas antiguas ya no existen", () => {
  it("ni el webhook de reseñas antiguo ni la ruta de la imagen existen", () => {
    expect(existsSync(join(ROOT, "app/api/webhooks", OLD_WEBHOOK))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/notifications"))).toBe(false);
  });

  it("la ruta de la imagen ya no es pública: si se recrea, el middleware la protege", () => {
    expect(isProtectedApiPath(`/api/notifications/${OLD_IMAGE_ROUTE}`)).toBe(true);
    expect(isProtectedApiPath(`/api/notifications/${OLD_IMAGE_ROUTE}?resena_id=1`)).toBe(true);
    expect(read("lib/auth/route-guard.ts")).not.toContain(OLD_IMAGE_ROUTE);
  });

  it("vercel.json ya no configura la función eliminada", () => {
    expect(read("vercel.json")).not.toContain(OLD_IMAGE_ROUTE);
  });

  it("los webhooks vigentes siguen públicos a nivel de sesión (con su propia autenticación)", () => {
    for (const path of ["/api/webhooks/whatsapp", "/api/webhooks/negative-review-alert", "/api/cron/informe-diario", "/api/internal/render"]) {
      expect(isProtectedApiPath(path), path).toBe(false);
    }
    expect(existsSync(join(ROOT, "app/api/webhooks/whatsapp/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/webhooks/negative-review-alert/route.ts"))).toBe(true);
  });
});

describe("SEC-009 no queda código del sistema antiguo", () => {
  it.each([
    ["sendWhatsAppImageAlert", OLD_SENDER],
    ["la tabla antigua", OLD_TABLE],
    ["EMPRESA_RECIPIENTS", OLD_RECIPIENTS],
    ["el webhook antiguo", OLD_WEBHOOK],
    ["la ruta de imagen antigua", OLD_IMAGE_ROUTE],
  ])("no aparece %s en el código", (_name, needle) => {
    expect(withText(ALL, needle)).toEqual([]);
  });

  it("ningún código activo lee el secreto antiguo (los tests pueden usarlo como secreto 'ajeno')", () => {
    expect(withText(NON_TEST, OLD_SECRET)).toEqual([]);
  });

  it("no se construyen URLs con el secreto en la query (?token=${...})", () => {
    const offenders = NON_TEST.filter((file) => /[?&]token=\$\{/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("el teléfono personal que estaba en el código de ese sistema ya no está en rutas ni notificaciones", () => {
    const files = NON_TEST.filter((file) => /[\\/](app[\\/]api|lib[\\/]notifications)[\\/]/.test(file));
    expect(files.length).toBeGreaterThan(0);
    expect(withText(files, PERSONAL_PHONE)).toEqual([]);
  });

  it("la operación whatsapp_alert_image del renderer fue eliminada; negative_review_image sigue", () => {
    const protocol = read("lib/render/protocol.ts");
    expect(protocol).not.toContain(["whatsapp_alert", "image"].join("_"));
    expect(protocol).toContain('"negative_review_image"');
  });

  it("buildAlertDataForResena se conserva: lo usa el sistema NUEVO de alertas", () => {
    expect(existsSync(join(ROOT, "lib/notifications/build-alert-for-resena.ts"))).toBe(true);
    expect(read("lib/alerts/negative-review/process.server.ts")).toContain("buildAlertDataForResena");
  });
});

describe("SEC-009 el fallback de texto de agentes (Make → Twilio) sigue intacto", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ sid: "SM123" });
    delete process.env.MAKE_DAILY_SUMMARY_WEBHOOK_URL;
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("sendWhatsAppText sigue exportada", () => {
    expect(typeof sendWhatsAppText).toBe("function");
  });

  it("sin Make configurado usa Twilio con prefijo whatsapp:", async () => {
    const result = await sendWhatsAppText({ to: "34600000000", body: "Resumen" });
    expect(result).toEqual({ ok: true, provider: "twilio", messageId: "SM123" });
    expect(create).toHaveBeenCalledWith({ from: "whatsapp:+14155238886", to: "whatsapp:+34600000000", body: "Resumen" });
  });

  it("con Make configurado usa Make y no Twilio", async () => {
    process.env.MAKE_DAILY_SUMMARY_WEBHOOK_URL = "https://hook.example/make";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message_id: "mk-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendWhatsAppText({ to: "+34 600 000 000", body: "Resumen" })).toEqual({ ok: true, provider: "make", messageId: "mk-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("sin transporte configurado falla de forma explícita (no envía)", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const result = await sendWhatsAppText({ to: "34600000000", body: "x" });
    expect(result).toMatchObject({ ok: false, provider: "none" });
    expect(create).not.toHaveBeenCalled();
  });

  it("processDueDailySummaries (resúmenes de agentes) sigue enviando con sendWhatsAppText", () => {
    const delivery = read("lib/agents/daily-summary-delivery.ts");
    expect(delivery).toMatch(/import \{ sendWhatsAppText \} from "@\/lib\/notifications\/whatsapp"/);
    expect(delivery).toContain("export async function processDueDailySummaries");
    expect(delivery).toMatch(/await sendWhatsAppText\(\{/);
  });
});
