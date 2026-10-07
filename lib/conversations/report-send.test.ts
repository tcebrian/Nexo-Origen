import { describe, expect, it, vi } from "vitest";
import {
  generateConversationReport,
  sendConversationReport,
  type ReportAdapterRegistry,
} from "@/lib/conversations/report-send";
import {
  buildMonthlyImageCaption,
  buildMonthlyImageFilename,
  buildMonthlyImagePreview,
  buildMonthlyReportFilename,
  buildMonthlyReportPreview,
  buildNetworkImageCaption,
  buildNetworkImageFilename,
  buildNetworkImagePreview,
  hasPdfSignature,
  hasPngSignature,
  monthlyReportAdapter,
  networkReportAdapter,
  type MonthlyReportSource,
  type NetworkReportSource,
} from "@/lib/conversations/report-adapters";
import {
  REPORT_CATALOG,
  type ReportDefinition,
  type ReportFormat,
  type ReportSubjectRef,
  type ReportTypeId,
} from "@/lib/conversations/report-catalog";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
} from "@/lib/conversations/outbound-fake.test-helper";
import type { SendMessageResult, UploadMediaResult } from "@/lib/whatsapp/cloud-api.server";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const MONTHLY_TARGET = { restaurantId: 123, name: "BK Zizur", startKey: "2026-09-01" };
const NETWORK_TARGET = {
  groupId: "bk",
  groupLabel: "Burger King",
  startKey: "2026-09-14",
  endKey: "2026-09-20",
  periodLabel: "14 al 20 de septiembre de 2026",
};

function setup(
  over: {
    target?: typeof MONTHLY_TARGET | null;
    networkTarget?: typeof NETWORK_TARGET | null;
    bytes?: Uint8Array;
    images?: Uint8Array[];
    networkImage?: Uint8Array;
    upload?: () => Promise<UploadMediaResult>;
    sendDoc?: () => Promise<SendMessageResult>;
    sendImg?: () => Promise<SendMessageResult>;
    repo?: Parameters<typeof createFakeOutboundRepo>[0];
  } = {}
) {
  const fake = createFakeOutboundRepo(over.repo);
  const monthly = {
    resolveTarget: vi.fn(async () => (over.target === undefined ? MONTHLY_TARGET : over.target)),
    generatePdf: vi.fn(async () => over.bytes ?? PDF),
    generateImages: vi.fn(async () => over.images ?? [PNG]),
  } satisfies MonthlyReportSource;
  const network = {
    resolveTarget: vi.fn(async () => (over.networkTarget === undefined ? NETWORK_TARGET : over.networkTarget)),
    generateImage: vi.fn(async () => over.networkImage ?? PNG),
  } satisfies NetworkReportSource;

  const adapters: ReportAdapterRegistry = {
    monthly: monthlyReportAdapter(monthly),
    weekly: networkReportAdapter("weekly", network),
    quarterly: networkReportAdapter("quarterly", network),
  };

  const uploadMedia = vi.fn(over.upload ?? (async () => ({ status: "uploaded", mediaId: "MEDIA-9" }) as const));
  const sendDocument = vi.fn(over.sendDoc ?? (async () => ({ status: "sent", wamid: "wamid.REPORT" }) as const));
  const sendImage = vi.fn(over.sendImg ?? (async () => ({ status: "sent", wamid: "wamid.IMAGE" }) as const));
  const sendText = vi.fn();

  const run = (
    request: Partial<{
      requestId: string;
      reportType: ReportTypeId;
      format: ReportFormat;
      subject: ReportSubjectRef;
      offset: number;
    }> = {}
  ) =>
    sendConversationReport(
      {
        conversationId: CONVERSATION_ID,
        requestId: REQUEST_ID,
        reportType: "monthly",
        format: "pdf",
        subject: { kind: "restaurant", restaurantId: 123 },
        offset: 0,
        ...request,
      },
      adapters,
      {
        repository: fake.repo,
        sendText,
        uploadMedia,
        sendDocument,
        sendImage,
        isConfigured: () => true,
        logger: { error: () => {} },
      }
    );

  const weeklyRequest = { reportType: "weekly", format: "image", subject: { kind: "network_group", groupId: "bk" } } as const;
  const quarterlyRequest = {
    reportType: "quarterly",
    format: "image",
    subject: { kind: "network_group", groupId: "bk" },
  } as const;

  return { ...fake, monthly, network, adapters, uploadMedia, sendDocument, sendImage, sendText, run, weeklyRequest, quarterlyRequest };
}

describe("nombres y vistas previas (mensual)", () => {
  it("PDF: nombre claro y saneado", () => {
    expect(buildMonthlyReportFilename(MONTHLY_TARGET)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026.pdf");
    expect(
      buildMonthlyReportFilename({ restaurantId: 1, name: "Café ../Ñandú <b>/ 5º", startKey: "2026-01-01" })
    ).toBe("Informe_Mensual_Cafe_Nandu_b_5_Enero_2026.pdf");
    expect(buildMonthlyReportFilename({ restaurantId: 1, name: "   ", startKey: "2026-12-01" })).toBe(
      "Informe_Mensual_Restaurante_Diciembre_2026.pdf"
    );
    expect(buildMonthlyReportPreview(MONTHLY_TARGET)).toBe("📊 Informe mensual · BK Zizur");
  });

  it("imagen: .png, sufijo solo con varias, pie y vista previa limpios", () => {
    expect(buildMonthlyImageFilename(MONTHLY_TARGET, 0, 1)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026.png");
    expect(buildMonthlyImageFilename(MONTHLY_TARGET, 1, 3)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026_2.png");
    expect(buildMonthlyImageCaption(MONTHLY_TARGET)).toBe("Informe mensual · BK Zizur · Septiembre 2026");
    expect(buildMonthlyImagePreview(MONTHLY_TARGET)).toBe("🖼️ Informe mensual · BK Zizur");
  });

  it("firmas PDF y PNG", () => {
    expect(hasPdfSignature(PDF)).toBe(true);
    expect(hasPdfSignature(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(false);
    expect(hasPngSignature(PNG)).toBe(true);
    expect(hasPngSignature(PDF)).toBe(false);
  });
});

describe("nombres y vistas previas (red)", () => {
  it("semanal y trimestral", () => {
    expect(buildNetworkImageFilename("weekly", NETWORK_TARGET)).toBe(
      "Informe_Semanal_Burger_King_2026-09-14_2026-09-20.png"
    );
    expect(
      buildNetworkImageFilename("quarterly", { ...NETWORK_TARGET, startKey: "2026-07-01", endKey: "2026-09-30" })
    ).toBe("Informe_Trimestral_Burger_King_2026_T3.png");
    expect(buildNetworkImageCaption("weekly", NETWORK_TARGET)).toBe(
      "Informe semanal · Burger King · 14 al 20 de septiembre de 2026"
    );
    expect(buildNetworkImagePreview("quarterly", NETWORK_TARGET)).toBe("🖼️ Informe trimestral · Burger King");
  });
});

describe("generateConversationReport (registro de adaptadores)", () => {
  it("elige el adaptador según el tipo de informe", async () => {
    const t = setup();
    await generateConversationReport({ reportType: "monthly", format: "pdf", subject: { kind: "restaurant", restaurantId: 1 }, offset: 0 }, t.adapters);
    expect(t.monthly.resolveTarget).toHaveBeenCalledWith(1, 0);
    expect(t.network.resolveTarget).not.toHaveBeenCalled();

    await generateConversationReport({ ...t.weeklyRequest, offset: 2 }, t.adapters);
    expect(t.network.resolveTarget).toHaveBeenLastCalledWith("weekly", "bk", 2);
    await generateConversationReport({ ...t.quarterlyRequest, offset: 1 }, t.adapters);
    expect(t.network.resolveTarget).toHaveBeenLastCalledWith("quarterly", "bk", 1);
  });

  it("no genera nada al planificar: solo al enviar", async () => {
    const t = setup();
    const plan = await generateConversationReport({ ...t.weeklyRequest, offset: 0 }, t.adapters);
    expect(plan?.files).toHaveLength(1);
    expect(t.network.generateImage).not.toHaveBeenCalled();
  });

  it("tipo deshabilitado, sin adaptador o formato no soportado → null", async () => {
    const t = setup();
    const subject = { kind: "restaurant", restaurantId: 1 } as const;
    expect(await generateConversationReport({ reportType: "semiannual", format: "pdf", subject, offset: 0 }, t.adapters)).toBeNull();
    expect(await generateConversationReport({ reportType: "annual", format: "pdf", subject, offset: 0 }, t.adapters)).toBeNull();
    // Habilitado en catálogo pero sin adaptador registrado.
    expect(await generateConversationReport({ ...t.weeklyRequest, offset: 0 }, { monthly: t.adapters.monthly })).toBeNull();
    // Formato que el tipo no soporta.
    expect(await generateConversationReport({ ...t.weeklyRequest, format: "pdf", offset: 0 }, t.adapters)).toBeNull();
  });

  it("un tipo nuevo se envía registrando su adaptador y habilitándolo en el catálogo (sin tocar el envío)", async () => {
    const t = setup();
    const semiannual: ReportDefinition = {
      id: "semiannual",
      label: "Informe semestral",
      enabled: true,
      subject: "restaurant",
      periodKind: "semiannual",
      formats: ["pdf"],
      maxOffset: 3,
      periodOptionCount: 4,
    };
    const catalog = [...REPORT_CATALOG.filter((d) => d.id !== "semiannual"), semiannual];
    const adapters: ReportAdapterRegistry = {
      semiannual: {
        async plan() {
          return {
            files: [
              {
                kind: "document",
                media: { mime_type: "application/pdf", filename: "Semestral.pdf", source: "nexo_report", report_type: "semiannual" },
                preview: "📊 Informe semestral",
                produce: async () => PDF,
              },
            ],
          };
        },
      },
    };

    const outcome = await sendConversationReport(
      {
        conversationId: CONVERSATION_ID,
        requestId: REQUEST_ID,
        reportType: "semiannual",
        format: "pdf",
        subject: { kind: "restaurant", restaurantId: 1 },
        offset: 0,
      },
      adapters,
      {
        repository: t.repo,
        sendText: t.sendText,
        uploadMedia: t.uploadMedia,
        sendDocument: t.sendDocument,
        sendImage: t.sendImage,
        isConfigured: () => true,
        logger: { error: () => {} },
      },
      catalog
    );
    expect(outcome.status).toBe("sent");
    expect(t.rows[0]!.media).toMatchObject({ report_type: "semiannual", filename: "Semestral.pdf" });
  });
});

describe("mensual PDF (sin cambios)", () => {
  it("restaurante o periodo inexistente → report_not_found sin generar ni reservar", async () => {
    const t = setup({ target: null });
    expect(await t.run()).toMatchObject({ status: "report_not_found" });
    expect(t.monthly.generatePdf).not.toHaveBeenCalled();
    expect(t.rows).toHaveLength(0);
  });

  it("flujo completo: genera en servidor, sube application/pdf, envía con el media_id y persiste", async () => {
    const t = setup();
    expect((await t.run()).status).toBe("sent");

    expect(t.monthly.resolveTarget).toHaveBeenCalledWith(123, 0);
    expect(t.monthly.generatePdf).toHaveBeenCalledWith(123, 0);
    expect(t.uploadMedia.mock.calls[0]![0]).toMatchObject({
      mimeType: "application/pdf",
      bytes: PDF,
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
      phoneNumberId: "1365004563368241",
    });
    expect(t.sendDocument.mock.calls[0]![0]).toMatchObject({ mediaId: "MEDIA-9", to: "+34600111222" });
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "document",
      status: "sent",
      external_id: "wamid.REPORT",
      client_request_id: REQUEST_ID,
      media: {
        mime_type: "application/pdf",
        provider_media_id: "MEDIA-9",
        size: PDF.length,
        source: "nexo_report",
        report_type: "monthly",
        restaurant_id: 123,
        period: "2026-09",
      },
    });
    expect(t.rows[0]!.media).not.toHaveProperty("report_format");
    expect(t.touches.map((x) => x.preview)).toEqual(["📊 Informe mensual · BK Zizur"]);
  });

  it("doble requestId, envío incierto y fallo al guardar: nunca se reenvía ni se regenera", async () => {
    const t = setup();
    await t.run();
    expect(await t.run()).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.monthly.generatePdf).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);

    const uncertain = setup({ sendDoc: async () => ({ status: "unconfirmed" }) });
    expect(await uncertain.run()).toMatchObject({ status: "unconfirmed" });
    expect(await uncertain.run()).toMatchObject({ status: "in_progress" });
    expect(uncertain.sendDocument).toHaveBeenCalledTimes(1);

    const unsaved = setup({ repo: { markSentFailures: 99 } });
    expect(await unsaved.run()).toMatchObject({ status: "sent_not_saved" });
    expect(await unsaved.run()).toMatchObject({ status: "in_progress" });
    expect(unsaved.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("PDF inválido o fallo del generador → generation_failed sin subir nada", async () => {
    const bad = setup({ bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) });
    expect(await bad.run()).toMatchObject({ status: "generation_failed" });
    expect(bad.uploadMedia).not.toHaveBeenCalled();

    const broken = setup();
    broken.monthly.generatePdf.mockRejectedValueOnce(new Error("datos no coinciden"));
    expect(await broken.run()).toMatchObject({ status: "generation_failed" });
    expect(broken.uploadMedia).not.toHaveBeenCalled();
  });

  it("conversación inexistente → not_found sin generar", async () => {
    const t = setup({ repo: { context: null } });
    expect(await t.run()).toMatchObject({ status: "not_found" });
    expect(t.monthly.generatePdf).not.toHaveBeenCalled();
  });
});

describe("mensual Imagen (sin cambios)", () => {
  it("genera la imagen en servidor, sube image/png, envía con el media_id y persiste", async () => {
    const t = setup();
    expect((await t.run({ format: "image" })).status).toBe("sent");

    expect(t.monthly.generateImages).toHaveBeenCalledWith(123, 0);
    expect(t.monthly.generatePdf).not.toHaveBeenCalled();
    expect(t.uploadMedia.mock.calls[0]![0]).toMatchObject({ mimeType: "image/png", bytes: PNG });
    expect(t.sendImage.mock.calls[0]![0]).toMatchObject({
      mediaId: "MEDIA-9",
      caption: "Informe mensual · BK Zizur · Septiembre 2026",
    });
    expect(t.rows[0]).toMatchObject({
      content_type: "image",
      external_id: "wamid.IMAGE",
      media: {
        mime_type: "image/png",
        source: "nexo_report",
        report_type: "monthly",
        report_format: "image",
        restaurant_id: 123,
        period: "2026-09",
        page_index: 0,
      },
    });
    expect(t.touches.map((x) => x.preview)).toEqual(["🖼️ Informe mensual · BK Zizur"]);
  });

  it("doble requestId e incierto: una sola imagen, sin volver a renderizar", async () => {
    const t = setup();
    await t.run({ format: "image" });
    expect(await t.run({ format: "image" })).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.monthly.generateImages).toHaveBeenCalledTimes(1);

    const uncertain = setup({ sendImg: async () => ({ status: "unconfirmed" }) });
    await uncertain.run({ format: "image" });
    expect(await uncertain.run({ format: "image" })).toMatchObject({ status: "in_progress" });
    expect(uncertain.monthly.generateImages).toHaveBeenCalledTimes(1);
  });

  it("imagen inválida (sin firma PNG, vacía o > 5 MB) → generation_failed sin subir nada", async () => {
    for (const images of [[PDF], [], [new Uint8Array(5 * 1024 * 1024 + 1).fill(1)]]) {
      const t = setup({ images });
      expect(await t.run({ format: "image" })).toMatchObject({ status: "generation_failed" });
      expect(t.uploadMedia).not.toHaveBeenCalled();
    }
  });
});

describe("informes de red (semanal y trimestral)", () => {
  it("semanal: resuelve grupo y semana en servidor, genera la imagen, la sube y la envía", async () => {
    const t = setup();
    expect((await t.run({ ...t.weeklyRequest, offset: 1 })).status).toBe("sent");

    expect(t.network.resolveTarget).toHaveBeenCalledWith("weekly", "bk", 1);
    expect(t.network.generateImage).toHaveBeenCalledWith("weekly", "bk", 1);
    expect(t.monthly.generatePdf).not.toHaveBeenCalled();
    expect(t.uploadMedia.mock.calls[0]![0]).toMatchObject({
      mimeType: "image/png",
      filename: "Informe_Semanal_Burger_King_2026-09-14_2026-09-20.png",
    });
    expect(t.sendImage.mock.calls[0]![0]).toMatchObject({
      mediaId: "MEDIA-9",
      caption: "Informe semanal · Burger King · 14 al 20 de septiembre de 2026",
    });
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "image",
      status: "sent",
      external_id: "wamid.IMAGE",
      media: {
        source: "nexo_report",
        report_type: "weekly",
        report_format: "image",
        group_id: "bk",
        period: "2026-09-14",
        page_index: 0,
      },
    });
    expect(t.touches.map((x) => x.preview)).toEqual(["🖼️ Informe semanal · Burger King"]);
  });

  it("trimestral: usa su propio tipo de periodo", async () => {
    const t = setup({ networkTarget: { ...NETWORK_TARGET, startKey: "2026-07-01", endKey: "2026-09-30", periodLabel: "1 de julio al 30 de septiembre de 2026" } });
    expect((await t.run({ ...t.quarterlyRequest, offset: 0 })).status).toBe("sent");
    expect(t.network.generateImage).toHaveBeenCalledWith("quarterly", "bk", 0);
    expect(t.rows[0]!.media).toMatchObject({ report_type: "quarterly", period: "2026-07-01" });
    expect(t.touches.map((x) => x.preview)).toEqual(["🖼️ Informe trimestral · Burger King"]);
  });

  it("grupo o periodo inexistente → report_not_found sin generar ni reservar", async () => {
    const t = setup({ networkTarget: null });
    expect(await t.run({ ...t.weeklyRequest, offset: 0 })).toMatchObject({ status: "report_not_found" });
    expect(t.network.generateImage).not.toHaveBeenCalled();
    expect(t.rows).toHaveLength(0);
  });

  it("el sujeto de otro tipo (restaurante) no vale para un informe de red", async () => {
    const t = setup();
    const outcome = await t.run({ ...t.weeklyRequest, subject: { kind: "restaurant", restaurantId: 5 } });
    expect(outcome).toMatchObject({ status: "report_not_found" });
    expect(t.network.generateImage).not.toHaveBeenCalled();
  });

  it("doble requestId e incierto: una sola imagen, sin volver a generar", async () => {
    const t = setup();
    await t.run({ ...t.weeklyRequest, offset: 0 });
    expect(await t.run({ ...t.weeklyRequest, offset: 0 })).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.network.generateImage).toHaveBeenCalledTimes(1);
    expect(t.sendImage).toHaveBeenCalledTimes(1);

    const uncertain = setup({ sendImg: async () => ({ status: "unconfirmed" }) });
    await uncertain.run({ ...uncertain.weeklyRequest, offset: 0 });
    expect(await uncertain.run({ ...uncertain.weeklyRequest, offset: 0 })).toMatchObject({ status: "in_progress" });
    expect(uncertain.network.generateImage).toHaveBeenCalledTimes(1);
  });

  it("imagen de red inválida → generation_failed", async () => {
    const t = setup({ networkImage: PDF });
    expect(await t.run({ ...t.weeklyRequest, offset: 0 })).toMatchObject({ status: "generation_failed" });
    expect(t.uploadMedia).not.toHaveBeenCalled();
  });

  it("la misma operación con otro periodo es una petición distinta (conflicto de requestId)", async () => {
    const t = setup();
    await t.run({ ...t.weeklyRequest, offset: 0 });
    t.network.resolveTarget.mockResolvedValueOnce({ ...NETWORK_TARGET, startKey: "2026-09-07", endKey: "2026-09-13" });
    expect(await t.run({ ...t.weeklyRequest, offset: 1 })).toMatchObject({ status: "request_conflict" });
    expect(t.network.generateImage).toHaveBeenCalledTimes(1);
  });
});
