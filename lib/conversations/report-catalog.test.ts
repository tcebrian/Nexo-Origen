import { describe, expect, it } from "vitest";
import {
  REPORT_CATALOG,
  enabledReportDefinitions,
  findEnabledDefinition,
  parseSendReportBody,
  periodOptionLabel,
  supportsFormat,
  type ReportDefinition,
} from "@/lib/conversations/report-catalog";
import { REQUEST_ID } from "@/lib/conversations/outbound-fake.test-helper";

const base = { requestId: REQUEST_ID };
const monthly = { ...base, reportType: "monthly", format: "pdf", restaurantId: 123, period: 2 };
const weekly = { ...base, reportType: "weekly", format: "image", groupId: "bk", period: 1 };
const quarterly = { ...base, reportType: "quarterly", format: "image", groupId: "sg-es", period: 0 };

describe("catálogo de informes", () => {
  it("devuelve solo los tipos habilitados con formatos reales", () => {
    expect(enabledReportDefinitions().map((d) => d.id)).toEqual(["weekly", "monthly", "quarterly"]);
  });

  it("los tipos previstos (semestral, anual) existen pero no se ofrecen ni se aceptan", () => {
    expect(REPORT_CATALOG.map((d) => d.id)).toEqual(expect.arrayContaining(["semiannual", "annual"]));
    expect(enabledReportDefinitions().map((d) => d.id)).not.toContain("semiannual");
    expect(enabledReportDefinitions().map((d) => d.id)).not.toContain("annual");
    expect(findEnabledDefinition("semiannual")).toBeNull();
    expect(parseSendReportBody({ ...monthly, reportType: "annual" })).toMatchObject({ ok: false });
  });

  it("monthly sigue disponible con PDF e Imagen", () => {
    const definition = findEnabledDefinition("monthly")!;
    expect(definition.formats).toEqual(["pdf", "image"]);
    expect(definition.subject).toBe("restaurant");
  });

  it("los formatos dependen del tipo: la red semanal y trimestral solo tienen imagen", () => {
    expect(findEnabledDefinition("weekly")!.formats).toEqual(["image"]);
    expect(findEnabledDefinition("quarterly")!.formats).toEqual(["image"]);
    expect(supportsFormat(findEnabledDefinition("weekly")!, "pdf")).toBe(false);
    expect(supportsFormat(findEnabledDefinition("monthly")!, "pdf")).toBe(true);
  });

  it("un tipo habilitado pero sin formatos no se ofrece", () => {
    const broken: ReportDefinition = { ...REPORT_CATALOG[1]!, id: "semiannual", enabled: true, formats: [] };
    expect(enabledReportDefinitions([broken])).toEqual([]);
  });
});

describe("parseSendReportBody", () => {
  it("acepta un informe de cada tipo habilitado", () => {
    expect(parseSendReportBody(monthly)).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      reportType: "monthly",
      format: "pdf",
      subject: { kind: "restaurant", restaurantId: 123 },
      offset: 2,
    });
    expect(parseSendReportBody(weekly)).toMatchObject({
      ok: true,
      reportType: "weekly",
      format: "image",
      subject: { kind: "network_group", groupId: "bk" },
      offset: 1,
    });
    expect(parseSendReportBody(quarterly)).toMatchObject({ ok: true, reportType: "quarterly", offset: 0 });
  });

  it("tipo desconocido, vacío o no textual → error", () => {
    for (const reportType of ["daily", "", 5, null, undefined, "constructor", "__proto__"]) {
      expect(parseSendReportBody({ ...monthly, reportType })).toMatchObject({ ok: false });
    }
  });

  it("formato no soportado por ese tipo → error", () => {
    expect(parseSendReportBody({ ...weekly, format: "pdf" })).toMatchObject({
      ok: false,
      error: "Formato no disponible para este informe",
    });
    expect(parseSendReportBody({ ...quarterly, format: "pdf" }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, format: "gif" }).ok).toBe(false);
  });

  it("sin formato: monthly usa pdf (compatibilidad) y los de red usan su único formato", () => {
    expect(parseSendReportBody({ ...monthly, format: undefined })).toMatchObject({ ok: true, format: "pdf" });
    expect(parseSendReportBody({ ...weekly, format: undefined })).toMatchObject({ ok: true, format: "image" });
  });

  it("el periodo se valida según el tipo", () => {
    expect(parseSendReportBody({ ...monthly, period: 35 }).ok).toBe(true);
    expect(parseSendReportBody({ ...monthly, period: 36 }).ok).toBe(false);
    expect(parseSendReportBody({ ...weekly, period: 51 }).ok).toBe(true);
    expect(parseSendReportBody({ ...weekly, period: 52 }).ok).toBe(false);
    expect(parseSendReportBody({ ...quarterly, period: 11 }).ok).toBe(true);
    expect(parseSendReportBody({ ...quarterly, period: 12 }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, period: -1 }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, period: 1.5 }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, period: "1" }).ok).toBe(false);
  });

  it("acepta `offset` como alias antiguo de `period`", () => {
    const { period: _period, ...rest } = monthly;
    void _period;
    expect(parseSendReportBody({ ...rest, offset: 3 })).toMatchObject({ ok: true, offset: 3 });
    expect(parseSendReportBody(rest)).toMatchObject({ ok: true, offset: 0 });
  });

  it("el sujeto debe corresponder al tipo", () => {
    expect(parseSendReportBody({ ...monthly, restaurantId: 0 }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, restaurantId: "123" }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, restaurantId: undefined, groupId: "bk" }).ok).toBe(false);
    expect(parseSendReportBody({ ...weekly, groupId: "zz" }).ok).toBe(false);
    expect(parseSendReportBody({ ...weekly, groupId: undefined, restaurantId: 5 }).ok).toBe(false);
  });

  it("requestId inválido o cuerpo inválido → error", () => {
    expect(parseSendReportBody({ ...monthly, requestId: "x" }).ok).toBe(false);
    expect(parseSendReportBody(null).ok).toBe(false);
  });

  it("ignora teléfono, canal, media_id, wamid, bytes, scope y ReportRecord", () => {
    const parsed = parseSendReportBody({
      ...monthly,
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
    expect(parsed).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      reportType: "monthly",
      format: "pdf",
      subject: { kind: "restaurant", restaurantId: 123 },
      offset: 2,
    });
  });

  it("añadir un tipo al catálogo basta para aceptarlo (sin tocar el parser)", () => {
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

    expect(parseSendReportBody({ ...monthly, reportType: "semiannual", period: 3 }).ok).toBe(false);
    expect(parseSendReportBody({ ...monthly, reportType: "semiannual", period: 3 }, catalog)).toMatchObject({
      ok: true,
      reportType: "semiannual",
    });
    expect(enabledReportDefinitions(catalog).map((d) => d.id)).toContain("semiannual");
  });
});

describe("periodOptionLabel", () => {
  it("mensual: mes y año", () => {
    expect(periodOptionLabel("monthly", { startKey: "2026-09-01", endKey: "2026-09-30", label: "x" })).toBe(
      "Septiembre 2026"
    );
  });

  it("trimestral: trimestre y meses", () => {
    expect(periodOptionLabel("quarterly", { startKey: "2026-07-01", endKey: "2026-09-30", label: "x" })).toBe(
      "T3 2026 (Julio – Septiembre)"
    );
    expect(periodOptionLabel("quarterly", { startKey: "2026-01-01", endKey: "2026-03-31", label: "x" })).toBe(
      "T1 2026 (Enero – Marzo)"
    );
  });

  it("semanal: el rango legible de la semana", () => {
    expect(
      periodOptionLabel("weekly", { startKey: "2026-09-14", endKey: "2026-09-20", label: "14 al 20 de septiembre de 2026" })
    ).toBe("14 al 20 de septiembre de 2026");
  });
});
