import { describe, expect, it, vi } from "vitest";
import {
  buildMonthlyImageCaption,
  buildMonthlyImageFilename,
  buildMonthlyImagePreview,
  buildMonthlyReportFilename,
  buildMonthlyReportPreview,
  hasPdfSignature,
  hasPngSignature,
  parseSendReportBody,
  sendMonthlyReport,
  type MonthlyReportSource,
} from "@/lib/conversations/report-send";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
} from "@/lib/conversations/outbound-fake.test-helper";
import type { SendMessageResult, UploadMediaResult } from "@/lib/whatsapp/cloud-api.server";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const TARGET = { restaurantId: 123, name: "BK Zizur", startKey: "2026-09-01" };

function setup(
  over: {
    target?: typeof TARGET | null;
    bytes?: Uint8Array;
    images?: Uint8Array[];
    upload?: () => Promise<UploadMediaResult>;
    send?: () => Promise<SendMessageResult>;
    repo?: Parameters<typeof createFakeOutboundRepo>[0];
  } = {}
) {
  const fake = createFakeOutboundRepo(over.repo);
  const source = {
    resolveTarget: vi.fn(async () => (over.target === undefined ? TARGET : over.target)),
    generatePdf: vi.fn(async () => over.bytes ?? PDF),
    generateImages: vi.fn(async () => over.images ?? [PNG]),
  } satisfies MonthlyReportSource;
  const uploadMedia = vi.fn(over.upload ?? (async () => ({ status: "uploaded", mediaId: "MEDIA-9" }) as const));
  const sendDocument = vi.fn(over.send ?? (async () => ({ status: "sent", wamid: "wamid.REPORT" }) as const));
  const sendImage = vi.fn(async () => ({ status: "sent", wamid: "wamid.IMAGE" }) as const);
  const sendText = vi.fn();

  const run = (
    input: { requestId?: string; format?: "pdf" | "image"; restaurantId?: number; offset?: number } = {}
  ) =>
    sendMonthlyReport(
      { conversationId: CONVERSATION_ID, requestId: REQUEST_ID, restaurantId: 123, offset: 0, ...input },
      source,
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
  return { ...fake, source, uploadMedia, sendDocument, sendImage, sendText, run };
}

describe("parseSendReportBody", () => {
  const valid = { requestId: REQUEST_ID, reportType: "monthly", restaurantId: 123, offset: 2 };

  it("acepta un cuerpo válido", () => {
    expect(parseSendReportBody(valid)).toEqual({ ok: true, ...valid, format: "pdf" });
    expect(parseSendReportBody({ ...valid, format: "image" })).toMatchObject({ ok: true, format: "image" });
    expect(parseSendReportBody({ ...valid, offset: undefined })).toMatchObject({ ok: true, offset: 0 });
  });

  it("rechaza requestId, tipo, restaurante y periodo inválidos", () => {
    expect(parseSendReportBody({ ...valid, requestId: "x" }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, reportType: "semanal" }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, format: "gif" }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, format: 1 }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, restaurantId: 0 }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, restaurantId: "123" }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, restaurantId: 1.5 }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, offset: -1 }).ok).toBe(false);
    expect(parseSendReportBody({ ...valid, offset: 36 }).ok).toBe(false);
    expect(parseSendReportBody(null).ok).toBe(false);
  });

  it("ignora teléfono, canal, media_id, wamid, bytes, scope y ReportRecord", () => {
    const parsed = parseSendReportBody({
      ...valid,
      to: "+34999999999",
      phone_number_id: "1",
      canal_id: "x",
      media_id: "m",
      wamid: "w",
      bytes: "AAAA",
      empresa: 1,
      scope: { rol: "super_admin" },
      report: { id: "r" },
    });
    expect(parsed).toEqual({ ok: true, ...valid, format: "pdf" });
  });
});

describe("nombre y vista previa", () => {
  it("nombre de archivo claro y saneado", () => {
    expect(buildMonthlyReportFilename(TARGET)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026.pdf");
    expect(
      buildMonthlyReportFilename({ restaurantId: 1, name: "Café ../Ñandú <b>/ 5º", startKey: "2026-01-01" })
    ).toBe("Informe_Mensual_Cafe_Nandu_b_5_Enero_2026.pdf");
    expect(buildMonthlyReportFilename({ restaurantId: 1, name: "   ", startKey: "2026-12-01" })).toBe(
      "Informe_Mensual_Restaurante_Diciembre_2026.pdf"
    );
  });

  it("vista previa limpia", () => {
    expect(buildMonthlyReportPreview(TARGET)).toBe("📊 Informe mensual · BK Zizur");
  });

  it("firma PDF", () => {
    expect(hasPdfSignature(PDF)).toBe(true);
    expect(hasPdfSignature(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(false);
  });
});

describe("imagen: nombres, pie y vista previa", () => {
  it("nombre .png, con sufijo solo si hay varias imágenes", () => {
    expect(buildMonthlyImageFilename(TARGET, 0, 1)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026.png");
    expect(buildMonthlyImageFilename(TARGET, 1, 3)).toBe("Informe_Mensual_BK_Zizur_Septiembre_2026_2.png");
  });

  it("pie y vista previa limpios, sin nombres técnicos", () => {
    expect(buildMonthlyImageCaption(TARGET)).toBe("Informe mensual · BK Zizur · Septiembre 2026");
    expect(buildMonthlyImagePreview(TARGET)).toBe("🖼️ Informe mensual · BK Zizur");
  });

  it("firma PNG", () => {
    expect(hasPngSignature(PNG)).toBe(true);
    expect(hasPngSignature(PDF)).toBe(false);
  });
});

describe("sendMonthlyReport (formato imagen)", () => {
  it("genera la imagen en servidor, sube image/png, envía con el media_id y persiste", async () => {
    const t = setup();
    expect((await t.run({ format: "image" })).status).toBe("sent");

    expect(t.source.generateImages).toHaveBeenCalledWith(123, 0);
    expect(t.source.generatePdf).not.toHaveBeenCalled();
    expect(t.uploadMedia.mock.calls[0]![0]).toMatchObject({
      mimeType: "image/png",
      bytes: PNG,
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.png",
    });
    expect(t.sendImage.mock.calls[0]![0]).toMatchObject({
      mediaId: "MEDIA-9",
      to: "+34600111222",
      caption: "Informe mensual · BK Zizur · Septiembre 2026",
    });
    expect(t.sendDocument).not.toHaveBeenCalled();
    expect(t.rows[0]).toMatchObject({
      direction: "outbound",
      sender_type: "human",
      content_type: "image",
      status: "sent",
      external_id: "wamid.IMAGE",
      client_request_id: REQUEST_ID,
      media: {
        mime_type: "image/png",
        provider_media_id: "MEDIA-9",
        size: PNG.length,
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

  it("doble requestId: una sola imagen y no se vuelve a renderizar", async () => {
    const t = setup();
    await t.run({ format: "image" });
    expect(await t.run({ format: "image" })).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.source.generateImages).toHaveBeenCalledTimes(1);
    expect(t.sendImage).toHaveBeenCalledTimes(1);
    expect(t.rows).toHaveLength(1);
  });

  it("envío incierto: el retry no renderiza ni reenvía", async () => {
    const t = setup();
    t.sendImage.mockResolvedValue({ status: "unconfirmed" } as never);
    expect(await t.run({ format: "image" })).toMatchObject({ status: "unconfirmed" });
    expect(await t.run({ format: "image" })).toMatchObject({ status: "in_progress" });
    expect(t.source.generateImages).toHaveBeenCalledTimes(1);
    expect(t.sendImage).toHaveBeenCalledTimes(1);
  });

  it("imagen inválida (sin firma PNG, vacía o > 5 MB) → generation_failed sin subir nada", async () => {
    for (const images of [[PDF], [], [new Uint8Array(5 * 1024 * 1024 + 1).fill(1)]]) {
      const t = setup({ images });
      expect(await t.run({ format: "image" })).toMatchObject({ status: "generation_failed" });
      expect(t.uploadMedia).not.toHaveBeenCalled();
    }
  });

  it("el PDF sigue enviándose como documento cuando no hay formato o es pdf", async () => {
    const t = setup();
    expect((await t.run()).status).toBe("sent");
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
    expect(t.sendImage).not.toHaveBeenCalled();
    expect(t.rows[0]).toMatchObject({ content_type: "document" });
    expect(t.rows[0]!.media).not.toHaveProperty("report_format");
  });
});

describe("sendMonthlyReport", () => {
  it("restaurante o periodo inexistente → report_not_found sin generar ni reservar", async () => {
    const t = setup({ target: null });
    expect(await t.run()).toMatchObject({ status: "report_not_found" });
    expect(t.source.generatePdf).not.toHaveBeenCalled();
    expect(t.rows).toHaveLength(0);
  });

  it("flujo completo: resuelve en servidor, genera el PDF, sube application/pdf, envía con el media_id y persiste", async () => {
    const t = setup();
    const outcome = await t.run();
    expect(outcome.status).toBe("sent");

    expect(t.source.resolveTarget).toHaveBeenCalledWith(123, 0);
    expect(t.source.generatePdf).toHaveBeenCalledWith(123, 0);
    expect(t.uploadMedia.mock.calls[0]![0]).toMatchObject({
      mimeType: "application/pdf",
      bytes: PDF,
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
      phoneNumberId: "1365004563368241",
    });
    expect(t.sendDocument.mock.calls[0]![0]).toMatchObject({
      mediaId: "MEDIA-9",
      to: "+34600111222",
      filename: "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf",
    });
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
    expect(t.touches.map((x) => x.preview)).toEqual(["📊 Informe mensual · BK Zizur"]);
  });

  it("doble requestId: un único informe y no se vuelve a generar", async () => {
    const t = setup();
    await t.run();
    const second = await t.run();
    expect(second).toMatchObject({ status: "sent", deduplicated: true });
    expect(t.source.generatePdf).toHaveBeenCalledTimes(1);
    expect(t.uploadMedia).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
    expect(t.rows).toHaveLength(1);
  });

  it("envío incierto: el reintento no genera ni reenvía", async () => {
    const t = setup({ send: async () => ({ status: "unconfirmed" }) });
    expect(await t.run()).toMatchObject({ status: "unconfirmed" });
    expect(await t.run()).toMatchObject({ status: "in_progress" });
    expect(t.source.generatePdf).toHaveBeenCalledTimes(1);
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("Meta acepta pero falla persistir: se reintenta guardar sin llamar a Meta y el retry no reenvía", async () => {
    const t = setup({ repo: { markSentFailures: 99 } });
    expect(await t.run()).toMatchObject({ status: "sent_not_saved" });
    expect(await t.run()).toMatchObject({ status: "in_progress" });
    expect(t.sendDocument).toHaveBeenCalledTimes(1);
    expect(t.uploadMedia).toHaveBeenCalledTimes(1);

    const recovered = setup({ repo: { markSentFailures: 2 } });
    expect((await recovered.run()).status).toBe("sent");
    expect(recovered.sendDocument).toHaveBeenCalledTimes(1);
  });

  it("PDF inválido (sin firma) o fallo del generador → generation_failed sin subir nada", async () => {
    const bad = setup({ bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) });
    expect(await bad.run()).toMatchObject({ status: "generation_failed" });
    expect(bad.uploadMedia).not.toHaveBeenCalled();

    const broken = setup();
    broken.source.generatePdf.mockRejectedValueOnce(new Error("datos no coinciden"));
    expect(await broken.run()).toMatchObject({ status: "generation_failed" });
    expect(broken.uploadMedia).not.toHaveBeenCalled();
    expect(broken.rows[0]!.status).toBe("failed");
  });

  it("conversación inexistente → not_found", async () => {
    const t = setup({ repo: { context: null } });
    expect(await t.run()).toMatchObject({ status: "not_found" });
    expect(t.source.generatePdf).not.toHaveBeenCalled();
  });
});
