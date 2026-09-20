const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  REPUTATION_TARGET,
  classifyMediaStatus,
  classifyReviewStars,
} = require("../.test-dist/lib/reputation/rules.js");

describe("reputation rules", () => {
  it("keeps the current target at 4.4", () => {
    assert.equal(REPUTATION_TARGET, 4.4);
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
