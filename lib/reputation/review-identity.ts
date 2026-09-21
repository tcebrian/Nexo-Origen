export type IncomingReviewIdentity = {
  provider: "google";
  placeId: string;
  reviewerId: string;
  providerReviewId: string;
  stars: number;
  comment?: string | null;
};

export type ExistingLogicalReview = {
  id: number | string;
  placeId: string;
  reviewerId: string;
  currentProviderReviewId?: string | null;
  currentStars: number;
  currentComment?: string | null;
  knownProviderReviewIds: string[];
};

export type ReviewIngestionDecision =
  | { kind: "new"; reason: "logical-review-not-found" }
  | { kind: "unchanged"; logicalReviewId: number | string; reason: "same-content" }
  | {
      kind: "edited";
      logicalReviewId: number | string;
      reason: "content-changed";
      providerReviewIdChanged: false;
    }
  | {
      kind: "recreated";
      logicalReviewId: number | string;
      reason: "same-account-place-new-provider-id";
      providerReviewIdChanged: true;
    };

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function buildLogicalReviewKey(input: {
  provider: string;
  placeId: string;
  reviewerId: string;
}): string {
  return [
    input.provider.trim().toLowerCase(),
    input.placeId.trim(),
    input.reviewerId.trim(),
  ].join(":");
}

export function buildReviewContentFingerprint(input: {
  stars: number;
  comment?: string | null;
}): string {
  return `${Math.round(input.stars)}|${normalizeText(input.comment).toLowerCase()}`;
}

export function decideReviewIngestion(
  incoming: IncomingReviewIdentity,
  existing: ExistingLogicalReview | null
): ReviewIngestionDecision {
  if (!existing) {
    return { kind: "new", reason: "logical-review-not-found" };
  }

  const sameContent =
    buildReviewContentFingerprint(incoming) ===
    buildReviewContentFingerprint({
      stars: existing.currentStars,
      comment: existing.currentComment,
    });

  const providerIdKnown =
    existing.knownProviderReviewIds.includes(incoming.providerReviewId) ||
    existing.currentProviderReviewId === incoming.providerReviewId;

  if (sameContent && providerIdKnown) {
    return {
      kind: "unchanged",
      logicalReviewId: existing.id,
      reason: "same-content",
    };
  }

  if (!providerIdKnown) {
    return {
      kind: "recreated",
      logicalReviewId: existing.id,
      reason: "same-account-place-new-provider-id",
      providerReviewIdChanged: true,
    };
  }

  return {
    kind: "edited",
    logicalReviewId: existing.id,
    reason: "content-changed",
    providerReviewIdChanged: false,
  };
}
