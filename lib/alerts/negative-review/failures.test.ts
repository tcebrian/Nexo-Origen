import { describe, expect, it } from "vitest";
import { describeAlertFailure, ERROR_CODE_MAX, imageFailureCode, isAlertFailure } from "./failures";

const row = (status: string, errorCode: string | null, errorReason: string | null = null) => ({ status, errorCode, errorReason });

describe("imageFailureCode", () => {
  it("cabe siempre en error_code sin cortar un campo por la mitad", () => {
    const code = imageFailureCode("analysis_pending", ["resumen", "impacto", "recomendacion", "sentimiento"]);
    expect(code.length).toBeLessThanOrEqual(ERROR_CODE_MAX);
    expect(code).toBe("image:analysis_pending:resumen,impacto+2");
  });

  it("sin campos, solo el tipo", () => {
    expect(imageFailureCode("RenderError:504")).toBe("image:RenderError:504");
  });

  it("si no cabe ningún campo, los cuenta", () => {
    const code = imageFailureCode("incomplete_data", ["un_campo_con_un_nombre_larguisimo_de_verdad"]);
    expect(code).toBe("image:incomplete_data+1");
  });
});

describe("isAlertFailure", () => {
  it("solo las alertas con motivo o fallidas", () => {
    expect(isAlertFailure(row("delivered", null))).toBe(false);
    expect(isAlertFailure(row("pending", null))).toBe(false);
    expect(isAlertFailure(row("failed", null))).toBe(true);
    expect(isAlertFailure(row("pending", "generation_failed", "rejected"))).toBe(true);
  });
});

describe("describeAlertFailure", () => {
  it("traduce la causa real de la imagen (análisis de IA sin terminar)", () => {
    const failure = describeAlertFailure(
      row("pending", "image:analysis_pending:resumen,impacto+2", "image_failed;last_inbound=2026-11-16T08:02:06.705Z")
    );
    expect(failure.reason).toBe(
      "La imagen no se generó: el análisis de IA de la reseña aún no estaba listo (resumen, impacto y 2 más)"
    );
    expect(failure.state).toBe("pending");
    expect(failure.unresolved).toBe(true);
    expect(failure.note).toContain("Ver alerta");
  });

  it("explica el tiempo agotado del generador", () => {
    expect(describeAlertFailure(row("pending", "image:RenderError:504", "image_failed;x")).reason).toBe(
      "El generador de imágenes tardó demasiado (tiempo agotado)"
    );
  });

  it("filas antiguas con generation_failed dicen que la causa no quedó registrada", () => {
    expect(describeAlertFailure(row("pending", "generation_failed", "rejected")).reason).toContain("no quedó registrada");
  });

  it("ventana de 24 h cerrada: se avisó con plantilla (no es un fallo sin resolver)", () => {
    const failure = describeAlertFailure(row("notified", "131047", "direct_rejected"));
    expect(failure.reason).toContain("24 h");
    expect(failure.note).toContain("plantilla");
    expect(failure.unresolved).toBe(false);
  });

  it("si se acabó entregando, queda resuelta", () => {
    const failure = describeAlertFailure(row("delivered", "generation_failed", "image_failed;x"));
    expect(failure.state).toBe("resolved");
    expect(failure.stateLabel).toBe("Entregada después");
    expect(failure.unresolved).toBe(false);
  });

  it("plantilla fallida con código de Meta", () => {
    const failure = describeAlertFailure(row("pending", "132001", "template"));
    expect(failure.reason).toBe(
      "No se pudo enviar la plantilla de aviso: La plantilla no existe o no está aprobada en ese idioma (código 132001)"
    );
  });

  it("envío incierto avisa de revisar la conversación", () => {
    const failure = describeAlertFailure(row("failed", "unconfirmed", "uncertain"));
    expect(failure.reason).toContain("No se pudo confirmar");
    expect(failure.state).toBe("failed");
  });

  it("excepción del servidor y reintento final con aviso", () => {
    expect(describeAlertFailure(row("failed", "exception", "TypeError")).reason).toBe("Error inesperado del servidor (TypeError)");
    const final = describeAlertFailure(row("pending", "image:RenderError:502", "image_failed_final;notice_sent;last_inbound=unknown"));
    expect(final.note).toContain("aviso de texto");
  });

  it("código de Meta desconocido", () => {
    expect(describeAlertFailure(row("pending", "999999", "rejected")).reason).toBe("WhatsApp devolvió el error 999999");
  });
});
