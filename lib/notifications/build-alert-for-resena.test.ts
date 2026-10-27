import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};

/** Cliente Supabase en memoria: solo los filtros que usa el constructor de la alerta. */
function fakeClient() {
  return {
    from(table: string) {
      let rows = [...(db[table] ?? [])];
      let single = false;
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => String(row[column]) === String(value));
          return builder;
        },
        order(column: string, opts?: { ascending?: boolean }) {
          const dir = opts?.ascending === false ? -1 : 1;
          rows.sort((a, b) => {
            const left = a[column] ?? "";
            const right = b[column] ?? "";
            if (left === right) return 0;
            return (left < right ? -1 : 1) * dir;
          });
          return builder;
        },
        range(from: number, to: number) {
          rows = rows.slice(from, to + 1);
          return builder;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return builder;
        },
        maybeSingle() {
          single = true;
          return builder;
        },
        then(resolve: (value: { data: unknown; error: null }) => void) {
          resolve({ data: single ? (rows[0] ?? null) : rows, error: null });
        },
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => fakeClient() }));

const { buildAlertDataForResena } = await import("./build-alert-for-resena");
const { AlertNotReadyError } = await import("@/lib/alerts/negative-review/alert-readiness");

const FAST = { timeoutMs: 0, intervalMs: 1 };
const ANALYSIS = {
  review_id: "g-1",
  resumen: "El cliente se queja de una espera prolongada.",
  motivo: "Atención al cliente",
  impacto: "Experiencia muy negativa; el cliente afirma que no volverá.",
  recomendacion: "Revisar tiempos de atención.",
  riesgo: "Alto",
  empleado_mencionado: null,
  sentimiento: "Negativo",
  created_at: "2026-10-26T14:50:00Z",
};

function seed() {
  db.marcas = [
    { id: 1, nombre: "Sibuya" },
    { id: 2, nombre: "Burger King" },
  ];
  db.restaurantes = [
    { id: 10, nombre: "Sibuya Prat de la Creu", direccion: "Plaça Prat de la Creu, Andorra la Vella", ciudad: "Andorra la Vella", empresa_id: 1, marca_id: 1 },
    { id: 20, nombre: "BK Utebo", direccion: "Utebo", ciudad: "Utebo", empresa_id: 2, marca_id: 2 },
  ];
  const history: Row[] = [];
  // 1.200 reseñas previas del restaurante 10 (más que el antiguo tope de 300): 600×5 + 600×4 → media 4,50.
  for (let i = 1; i <= 1200; i += 1) {
    history.push({
      id: i,
      review_id: `old-${i}`,
      restaurante_id: 10,
      estrellas: i % 2 ? 5 : 4,
      fecha_resena: new Date(Date.UTC(2025, 0, 1) + i * 3_600_000).toISOString(),
      created_at: null,
    });
  }
  // La reseña negativa, la más reciente.
  history.push({
    id: 5000,
    review_id: "g-1",
    restaurante_id: 10,
    autor: "Gemma Ibañez",
    estrellas: 1,
    comentario: "Hemos esperado mucho para que nos hicieran caso. Mal servicio y no volveremos.",
    fecha_resena: "2026-10-26T14:47:00Z",
    created_at: "2026-10-26T14:48:00Z",
    restaurante_nombre: "Sibuya Prat de la Creu",
    direccion: null,
    ciudad: null,
  });
  // Reseñas de OTRO restaurante: no deben entrar en la media.
  for (let i = 0; i < 50; i += 1) {
    history.push({ id: 6000 + i, review_id: `bk-${i}`, restaurante_id: 20, estrellas: 1, fecha_resena: "2026-01-01T00:00:00Z", created_at: null });
  }
  db.resenas = history;
  db.analisis_ia = [ANALYSIS];
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  seed();
});

describe("buildAlertDataForResena", () => {
  it("construye la alerta completa con el análisis IA y las medias reales del restaurante", async () => {
    const data = await buildAlertDataForResena(5000, { analysisWait: FAST });
    expect(data).not.toBeNull();
    expect(data).toMatchObject({
      brand: "sibuya",
      brand_name: "Sibuya",
      restaurant_name: "SIBUYA PRAT DE LA CREU",
      review_author: "Gemma Ibañez",
      review_stars: 1,
      risk_level: "ALTO",
      sentiment: "Negativo",
      ai_summary: ANALYSIS.resumen,
      detected_impact: ANALYSIS.impacto, // texto de la IA, no el delta numérico
      recommendation: ANALYSIS.recomendacion,
      main_motive: "Atención al cliente",
    });
    // Media previa sobre las 1.200 reseñas (4,50), no sobre las últimas 300; las del otro local (1★) no cuentan.
    expect(data!.previous_rating).toBeCloseTo(4.5, 5);
    expect(data!.current_rating).toBeCloseTo((1200 * 4.5 + 1) / 1201, 5);
    expect(data!.rating_impact).toBeCloseTo(data!.current_rating - data!.previous_rating, 8);
  });

  it("sin análisis IA NO genera la alerta: analysis_pending (queda reintentable) y no inventa texto", async () => {
    db.analisis_ia = [];
    await expect(buildAlertDataForResena(5000, { analysisWait: FAST })).rejects.toMatchObject({ code: "analysis_pending" });
  });

  it("un análisis a medias (sin recomendación) tampoco se da por completado", async () => {
    db.analisis_ia = [{ ...ANALYSIS, recomendacion: null }];
    await expect(buildAlertDataForResena(5000, { analysisWait: FAST })).rejects.toMatchObject({ code: "analysis_pending", fields: ["recomendacion"] });
  });

  it("filas duplicadas de análisis (Make reintentó) no rompen la lectura", async () => {
    db.analisis_ia = [{ ...ANALYSIS, created_at: "2026-10-26T14:49:00Z", resumen: "Antiguo" }, ANALYSIS];
    const data = await buildAlertDataForResena(5000, { analysisWait: FAST });
    expect(data!.ai_summary).toBe(ANALYSIS.resumen);
  });

  it("una reseña solo con estrellas se envía sin análisis (no hay nada que analizar)", async () => {
    db.analisis_ia = [];
    db.resenas!.find((row) => row.id === 5000)!.comentario = "";
    const data = await buildAlertDataForResena(5000, { analysisWait: FAST });
    expect(data).not.toBeNull();
    expect(data!.review_comment).toBe("Sin comentario");
  });

  it("restaurante sin marca: se rechaza en vez de caer en Burger King", async () => {
    db.restaurantes!.find((row) => row.id === 10)!.marca_id = null;
    await expect(buildAlertDataForResena(5000, { analysisWait: FAST })).rejects.toMatchObject({ code: "invalid_scope", fields: ["brand"] });
  });

  it("review_id compartido con otro local: no se usa un análisis que podría ser ajeno", async () => {
    db.resenas!.push({ id: 7000, review_id: "g-1", restaurante_id: 20, estrellas: 2, fecha_resena: "2026-10-26T10:00:00Z", created_at: null });
    await expect(buildAlertDataForResena(5000, { analysisWait: FAST })).rejects.toBeInstanceOf(AlertNotReadyError);
  });

  it("la marca y el local salen del restaurante de la reseña (alertas con otra marca)", async () => {
    db.analisis_ia = [{ ...ANALYSIS, review_id: "bk-0" }];
    Object.assign(db.resenas!.find((row) => row.id === 6000)!, { autor: "Luis", comentario: "Tardaron mucho", restaurante_nombre: "BK Utebo" });
    const data = await buildAlertDataForResena(6000, { analysisWait: FAST });
    expect(data).toMatchObject({ brand: "bk", brand_name: "Burger King" });
    // Solo cuenta el historial del restaurante 20 (50 reseñas de 1★): ninguna del restaurante 10.
    expect(data!.current_rating).toBe(1);
  });

  it("reseña inexistente → null", async () => {
    expect(await buildAlertDataForResena(999_999, { analysisWait: FAST })).toBeNull();
  });
});
