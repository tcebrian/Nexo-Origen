import { describe, expect, it } from "vitest";
import { isRequestAllowed } from "@/lib/render/network-guard";
import {
  RENDER_OPERATIONS,
  RENDER_SIGNATURE_WINDOW_MS,
  isSafeAssetUrl,
  parseRenderRequest,
  renderSecret,
  resolveInternalOrigin,
  signRenderBody,
  verifyRenderSignature,
} from "@/lib/render/protocol";
import { SECRET, sampleAlert, sampleMonthlyReport } from "@/lib/render/fixtures.test-helper";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("operaciones permitidas", () => {
  it("solo las cinco operaciones cerradas", () => {
    expect([...RENDER_OPERATIONS]).toEqual(["monthly_pdf", "monthly_image", "negative_review_image", "network_summary_image", "whatsapp_alert_image"]);
  });

  it("monthly_pdf y monthly_image aceptan un informe válido", () => {
    for (const op of ["monthly_pdf", "monthly_image"]) {
      const parsed = parseRenderRequest({ op, report: sampleMonthlyReport() });
      expect(parsed).toMatchObject({ ok: true, request: { op } });
    }
  });

  it("negative_review_image y whatsapp_alert_image aceptan datos de alerta válidos", () => {
    for (const op of ["negative_review_image", "whatsapp_alert_image"]) {
      expect(parseRenderRequest({ op, data: sampleAlert() })).toMatchObject({ ok: true, request: { op } });
    }
  });

  it("network_summary_image acepta periodo, grupo y desplazamiento", () => {
    expect(parseRenderRequest({ op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 1 })).toMatchObject({
      ok: true,
      request: { op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 1 },
    });
  });
});

describe("operación desconocida y payload inválido", () => {
  it("rechaza operaciones fuera de la lista, incluidas las genéricas", () => {
    for (const op of ["conversation_report", "screenshot", "render_url", "goto", "", "MONTHLY_PDF", 3, null]) {
      expect(parseRenderRequest({ op, report: sampleMonthlyReport() }).ok).toBe(false);
    }
    expect(parseRenderRequest(null).ok).toBe(false);
    expect(parseRenderRequest([]).ok).toBe(false);
    expect(parseRenderRequest({}).ok).toBe(false);
  });

  it("informe mensual con forma incorrecta", () => {
    const base = sampleMonthlyReport();
    const bad: unknown[] = [
      null,
      { ...base, restaurant: { ...base.restaurant, name: 42 } },
      { ...base, startKey: "septiembre" },
      { ...base, weeks: "no" },
      { ...base, weeks: [{ ...base.weeks[0], stars: [1, 2] }] },
      { ...base, reviews: Array.from({ length: 401 }, () => base.reviews[0]) },
      { ...base, criticalMaxStars: 5 },
      { ...base, current: { a: { b: 1 } } },
      { ...base, reviews: [{ ...base.reviews[0], comment: "x".repeat(6001) }] },
    ];
    for (const report of bad) expect(parseRenderRequest({ op: "monthly_pdf", report }).ok).toBe(false);
  });

  it("alerta con tipos incorrectos o desmesurada", () => {
    const bad: unknown[] = [
      null,
      "texto",
      { ...sampleAlert(), restaurant_name: { x: 1 } },
      { ...sampleAlert(), review_comment: "x".repeat(6001) },
      { ...sampleAlert(), detected_reasons: [1, 2] },
      { ...sampleAlert(), extra: { anidado: true } },
      Object.fromEntries(Array.from({ length: 90 }, (_, i) => [`k${i}`, "v"])),
    ];
    for (const data of bad) expect(parseRenderRequest({ op: "negative_review_image", data }).ok).toBe(false);
  });

  it("network_summary_image rechaza periodo, grupo y desplazamiento fuera de las listas", () => {
    const base = { op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 };
    for (const over of [{ periodo: "diario" }, { periodo: 1 }, { grupo: "../../etc" }, { grupo: "" }, { offset: 1.5 }, { offset: "1" }, { offset: 9999 }]) {
      expect(parseRenderRequest({ ...base, ...over }).ok).toBe(false);
    }
  });
});

describe("URL arbitraria y SSRF", () => {
  it("el renderer no tiene ningún parámetro de URL, host u origen: lo que llegue se ignora", () => {
    const parsed = parseRenderRequest({
      op: "network_summary_image",
      periodo: "semanal",
      grupo: "bk",
      offset: 0,
      url: "http://169.254.169.254/latest/meta-data",
      host: "evil.example",
      origin: "https://evil.example",
    });
    expect(parsed).toEqual({ ok: true, request: { op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 } });
  });

  it("las URL de imagen de la alerta solo pueden ser rutas propias o data:", () => {
    for (const url of ["http://169.254.169.254/x.png", "https://evil.example/logo.png", "//evil.example/logo.png", "file:///etc/passwd", "javascript:alert(1)", "/\\evil.example"]) {
      expect(isSafeAssetUrl(url)).toBe(false);
      expect(parseRenderRequest({ op: "negative_review_image", data: sampleAlert({ brand_logo_url: url }) }).ok).toBe(false);
      expect(parseRenderRequest({ op: "whatsapp_alert_image", data: sampleAlert({ nexo_logo_url: url }) }).ok).toBe(false);
    }
    for (const url of ["/brands/burger-king.png", "", "data:image/png;base64,AAAA"]) expect(isSafeAssetUrl(url)).toBe(true);
    expect(parseRenderRequest({ op: "negative_review_image", data: sampleAlert({ brand_logo_url: "/brands/burger-king.png" }) }).ok).toBe(true);
  });

  it("Chromium solo sale a data:, about: y al origen propio", () => {
    const origin = "https://nexo.example";
    expect(isRequestAllowed("data:image/png;base64,AAAA", origin)).toBe(true);
    expect(isRequestAllowed("about:blank", null)).toBe(true);
    expect(isRequestAllowed(`${origin}/templates/network-summary/semanal/bk?offset=0`, origin)).toBe(true);
    expect(isRequestAllowed(`${origin}/_next/static/a.js`, origin)).toBe(true);
    for (const url of [
      "https://evil.example/x.png",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/api/internal/render",
      "http://10.0.0.1/",
      "http://nexo.example/x", // otro esquema = otro origen
      "https://nexo.example.evil.example/x",
      "file:///etc/passwd",
      "ftp://x/y",
      "not a url",
    ]) {
      expect(isRequestAllowed(url, origin)).toBe(false);
    }
    // Sin origen permitido (informes con HTML incrustado) no sale a ninguna red.
    expect(isRequestAllowed(`${origin}/x`, null)).toBe(false);
    expect(isRequestAllowed("http://127.0.0.1/", null)).toBe(false);
  });
});

describe("firma HMAC y marca de tiempo", () => {
  const body = bytes(JSON.stringify({ op: "monthly_pdf" }));
  const now = 1_790_000_000_000;
  const check = (over: Partial<Parameters<typeof verifyRenderSignature>[0]> = {}) =>
    verifyRenderSignature({
      rawBody: body,
      timestamp: String(now),
      signature: signRenderBody(body, SECRET, now),
      secret: SECRET,
      nowMs: now,
      ...over,
    });

  it("firma correcta", () => {
    expect(check()).toEqual({ ok: true });
    expect(check({ nowMs: now + RENDER_SIGNATURE_WINDOW_MS })).toEqual({ ok: true });
  });

  it("token incorrecto", () => {
    expect(check({ signature: signRenderBody(body, "otro-secreto-que-no-es-el-bueno", now) })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("HMAC incorrecto, mal formado o con el cuerpo alterado", () => {
    expect(check({ signature: "0".repeat(64) })).toMatchObject({ ok: false });
    expect(check({ signature: "xyz" })).toMatchObject({ ok: false });
    expect(check({ signature: null })).toMatchObject({ ok: false });
    expect(check({ rawBody: bytes(JSON.stringify({ op: "monthly_image" })) })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("marca de tiempo caducada, futura o inválida", () => {
    expect(check({ nowMs: now + RENDER_SIGNATURE_WINDOW_MS + 1 })).toEqual({ ok: false, reason: "expired" });
    expect(check({ nowMs: now - RENDER_SIGNATURE_WINDOW_MS - 1 })).toEqual({ ok: false, reason: "expired" });
    expect(check({ timestamp: "ayer" })).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(check({ timestamp: null })).toEqual({ ok: false, reason: "bad_timestamp" });
  });

  it("cambiar la marca de tiempo invalida la firma", () => {
    expect(check({ timestamp: String(now + 1) })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("sin credencial configurada (o demasiado corta) no se acepta nada", () => {
    expect(check({ secret: null })).toEqual({ ok: false, reason: "missing_secret" });
    expect(renderSecret({ NEXO_INTERNAL_RENDER_TOKEN: "corto" } as never)).toBeNull();
    expect(renderSecret({ NEXO_INTERNAL_RENDER_TOKEN: SECRET } as never)).toBe(SECRET);
  });
});

describe("origen fijado por el servidor", () => {
  const origin = (env: Record<string, string>) => resolveInternalOrigin(env as never);

  it("producción usa el dominio de producción; preview, la URL del despliegue", () => {
    expect(origin({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "app.nexo.example", VERCEL_URL: "nexo-abc.vercel.app" })).toBe("https://app.nexo.example");
    expect(origin({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "app.nexo.example", VERCEL_URL: "nexo-abc.vercel.app" })).toBe("https://nexo-abc.vercel.app");
  });

  it("en local, localhost y el puerto configurado", () => {
    expect(origin({})).toBe("http://localhost:3000");
    expect(origin({ PORT: "3100" })).toBe("http://localhost:3100");
  });

  it("el override solo admite https (o http en localhost)", () => {
    expect(origin({ NEXO_INTERNAL_ORIGIN: "https://render.nexo.example/" })).toBe("https://render.nexo.example");
    expect(origin({ NEXO_INTERNAL_ORIGIN: "http://localhost:3001" })).toBe("http://localhost:3001");
    expect(() => origin({ NEXO_INTERNAL_ORIGIN: "http://evil.example" })).toThrow();
    expect(() => origin({ NEXO_INTERNAL_ORIGIN: "ftp://x" })).toThrow();
  });
});
