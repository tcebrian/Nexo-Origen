const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  REPUTATION_TARGET,
  REPUTATION_WATCH_THRESHOLD,
  classifyMediaStatus,
  classifyReviewStars,
  getReviewAttentionLevel,
  isKpiNegativeReview,
  isReviewRequiringAttention,
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
  percentageOfTotal,
  weightedAverage,
} = require("../.test-dist/lib/reputation/aggregation.js");

const {
  summarizeReputation,
  summarizeOperationalReputation,
  summarizeKpiReputation,
  toRankingReputationBase,
} = require("../.test-dist/lib/reputation/summary.js");

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

  it("distinguishes KPI negatives from reviews that require attention", () => {
    assert.equal(isKpiNegativeReview(1), true);
    assert.equal(isKpiNegativeReview(2), true);
    assert.equal(isKpiNegativeReview(3), false);
    assert.equal(isKpiNegativeReview(4), false);

    assert.equal(isReviewRequiringAttention(1), true);
    assert.equal(isReviewRequiringAttention(2), true);
    assert.equal(isReviewRequiringAttention(3), true);
    assert.equal(isReviewRequiringAttention(4), false);
    assert.equal(isReviewRequiringAttention(5), false);
  });

  it("maps 1-2 to critical, 3 to follow-up and 4-5 to no attention", () => {
    assert.equal(getReviewAttentionLevel(1), "critical");
    assert.equal(getReviewAttentionLevel(2), "critical");
    assert.equal(getReviewAttentionLevel(3), "follow_up");
    assert.equal(getReviewAttentionLevel(4), "none");
    assert.equal(getReviewAttentionLevel(5), "none");
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

describe("canonical aggregation math", () => {
  it("matches the legacy weighted-average formula exactly", () => {
    const values = [
      { value: 4.5, weight: 100 },
      { value: 3.0, weight: 2 },
      { value: 5.0, weight: 7 },
    ];

    const legacy =
      values.reduce((sum, item) => sum + item.value * item.weight, 0) /
      values.reduce((sum, item) => sum + item.weight, 0);

    assert.equal(weightedAverage(values), legacy);
  });

  it("returns zero for a weighted average with no review volume", () => {
    assert.equal(
      weightedAverage([
        { value: 4.9, weight: 0 },
        { value: 2.0, weight: 0 },
      ]),
      0
    );
  });

  it("matches the legacy one-decimal percentage formula", () => {
    const part = 7;
    const total = 13;
    const legacy = Math.round((part / total) * 1000) / 10;

    assert.equal(percentageOfTotal(part, total), legacy);
    assert.equal(percentageOfTotal(0, 0), 0);
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


describe("consumer parity fixture", () => {
  const canonical = [
    {
      id: 1,
      media: 4.5,
      reviews: 10,
      positives: 7,
      negatives: 2,
      status: "on_target",
    },
    {
      id: 2,
      media: 3.8,
      reviews: 5,
      positives: 3,
      negatives: 1,
      status: "critical",
    },
  ];

  it("keeps dashboard and reports on the same network KPIs", () => {
    const expected = summarizeReputation(canonical);

    const dashboard = summarizeOperationalReputation(
      canonical.map((row) => ({
        currentMedia: row.media,
        totalReviews: row.reviews,
        positiveReviews: row.positives,
        negativeReviews: row.negatives,
        status: row.status,
      }))
    );

    const report = summarizeKpiReputation(
      canonical.map((row) => ({
        media_total: row.media,
        total_resenas: row.reviews,
        resenas_positivas: row.positives,
        resenas_negativas: row.negatives,
      }))
    );

    assert.equal(expected.reviews, 15);
    assert.equal(expected.negatives, 3);
    assert.equal(expected.positives, 10);
    assert.ok(Math.abs(expected.media - 64 / 15) < 1e-12);
    assert.equal(expected.negativePct, 20);
    assert.equal(expected.positivePct, 66.7);

    assert.deepEqual(
      {
        media: dashboard.media,
        reviews: dashboard.reviews,
        positives: dashboard.positives,
        negatives: dashboard.negatives,
        positivePct: dashboard.positivePct,
        negativePct: dashboard.negativePct,
      },
      {
        media: expected.media,
        reviews: expected.reviews,
        positives: expected.positives,
        negatives: expected.negatives,
        positivePct: expected.positivePct,
        negativePct: expected.negativePct,
      }
    );

    assert.deepEqual(report, {
      ...expected,
      onTarget: 0,
      watch: 0,
      critical: 0,
    });
  });

  it("keeps dashboard status counts aligned with the canonical fixture", () => {
    const dashboard = summarizeOperationalReputation(
      canonical.map((row) => ({
        currentMedia: row.media,
        totalReviews: row.reviews,
        positiveReviews: row.positives,
        negativeReviews: row.negatives,
        status: row.status,
      }))
    );

    assert.equal(dashboard.onTarget, 1);
    assert.equal(dashboard.watch, 0);
    assert.equal(dashboard.critical, 1);
  });

  it("keeps ranking restaurant KPIs identical to canonical period metrics", () => {
    for (const row of canonical) {
      const ranking = toRankingReputationBase({
        media: row.media,
        totalResenas: row.reviews,
        resenasNegativas: row.negatives,
      });

      assert.deepEqual(ranking, {
        media: row.media,
        reviews: row.reviews,
        negatives: row.negatives,
      });
    }
  });
});
