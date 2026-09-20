const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  REPUTATION_TARGET,
  REPUTATION_WATCH_THRESHOLD,
  classifyMediaStatus,
  classifyReviewStars,
} = require("../.test-dist/lib/reputation/rules.js");

const {
  dedupeResenas,
} = require("../.test-dist/lib/reputation/dedupe.js");

const {
  getResenaActivityDateValue,
} = require("../.test-dist/lib/reputation/review-date.js");

const {
  aggregateKpiDailyByRestaurant,
  choosePeriodMetricsSource,
} = require("../.test-dist/lib/reputation/aggregation.js");

describe("reputation rules", () => {
  it("keeps the current target and watch threshold", () => {
    assert.equal(REPUTATION_TARGET, 4.4);
    assert.equal(REPUTATION_WATCH_THRESHOLD, 4.0);
  });

  it("classifies 4-5 as positive, 3 as neutral, and 1-2 as negative", () => {
    assert.equal(classifyReviewStars(5), "positive");
    assert.equal(classifyReviewStars(4), "positive");
    assert.equal(classifyReviewStars(3), "neutral");
    assert.equal(classifyReviewStars(2), "negative");
    assert.equal(classifyReviewStars(1), "negative");
  });

  it("treats 4.4 exactly as on target", () => {
    assert.deepEqual(classifyMediaStatus(4.4, true), {
      statusLabel: "Óptimo",
      operationalStatus: "on_target",
    });
  });

  it("treats 4.0 exactly as watch", () => {
    assert.deepEqual(classifyMediaStatus(4.0, true), {
      statusLabel: "En riesgo",
      operationalStatus: "watch",
    });
  });

  it("treats values below 4.0 as critical", () => {
    assert.deepEqual(classifyMediaStatus(3.99, true), {
      statusLabel: "Crítico",
      operationalStatus: "critical",
    });
  });

  it("characterizes the current no-review behavior as watch", () => {
    assert.deepEqual(classifyMediaStatus(0, false), {
      statusLabel: "En riesgo",
      operationalStatus: "watch",
    });
  });
});

describe("review deduplication", () => {
  it("keeps one row when review_id is repeated and prefers the newer row", () => {
    const rows = [
      {
        id: 10,
        review_id: "google-1",
        restaurante_id: 1,
        estrellas: 1,
        fecha_resena: "2026-09-01T10:00:00Z",
        autor: "Ana",
        comentario: "Mal",
      },
      {
        id: 11,
        review_id: "google-1",
        restaurante_id: 1,
        estrellas: 5,
        fecha_resena: "2026-09-10T10:00:00Z",
        autor: "Ana",
        comentario: "Ahora perfecto",
      },
    ];

    const result = dedupeResenas(rows);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 11);
    assert.equal(result[0].estrellas, 5);
  });

  it("deduplicates identical content even when external review_id differs", () => {
    const rows = [
      {
        id: 20,
        review_id: "source-a",
        restaurante_id: 2,
        restaurante: "Local 2",
        estrellas: 4,
        fecha_resena: "2026-09-12T12:00:00Z",
        autor: "Luis",
        comentario: "Todo bien",
      },
      {
        id: 21,
        review_id: "source-b",
        restaurante_id: 2,
        restaurante: "Local 2",
        estrellas: 4,
        fecha_resena: "2026-09-12T12:00:00Z",
        autor: "Luis",
        comentario: "Todo bien",
      },
    ];

    const result = dedupeResenas(rows);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 21);
  });
});

describe("edited review activity date", () => {
  it("uses last edit date for an edited review", () => {
    assert.equal(
      getResenaActivityDateValue({
        editada: true,
        fecha_resena: "2026-08-01T10:00:00Z",
        fecha_ultima_edicion: "2026-09-15T18:00:00Z",
        created_at: "2026-08-01T10:05:00Z",
      }),
      "2026-09-15T18:00:00Z"
    );
  });

  it("uses original review date when the review is not marked as edited", () => {
    assert.equal(
      getResenaActivityDateValue({
        editada: false,
        fecha_resena: "2026-08-01T10:00:00Z",
        fecha_ultima_edicion: "2026-09-15T18:00:00Z",
        created_at: "2026-08-01T10:05:00Z",
      }),
      "2026-08-01T10:00:00Z"
    );
  });

  it("falls back to created_at when no source review date exists", () => {
    assert.equal(
      getResenaActivityDateValue({
        editada: false,
        fecha_resena: null,
        created_at: "2026-08-01T10:05:00Z",
      }),
      "2026-08-01T10:05:00Z"
    );
  });
});

describe("kpi diario fallback and weighted aggregation", () => {
  it("prefers individual reviews over kpi_diario, then kpi_diario, then empty", () => {
    assert.equal(choosePeriodMetricsSource(4, 8), "resenas");
    assert.equal(choosePeriodMetricsSource(0, 8), "kpi_diario");
    assert.equal(choosePeriodMetricsSource(0, 0), "empty");
  });

  it("calculates kpi_diario averages weighted by review volume", () => {
    const aggregated = aggregateKpiDailyByRestaurant([
      {
        restaurante_id: 1,
        total_resenas: 100,
        media: 4.5,
        negativas: 5,
        positivas: 90,
      },
      {
        restaurante_id: 1,
        total_resenas: 2,
        media: 3.0,
        negativas: 1,
        positivas: 1,
      },
    ]);

    const restaurant = aggregated.get(1);
    assert.ok(restaurant);
    assert.equal(restaurant.totalResenas, 102);
    assert.equal(restaurant.negativas, 6);
    assert.equal(restaurant.positivas, 91);
    assert.ok(Math.abs(restaurant.media - 456 / 102) < 1e-12);
    assert.notEqual(restaurant.media, (4.5 + 3.0) / 2);
  });
});
