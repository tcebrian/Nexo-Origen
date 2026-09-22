type IncomingReview = {
  provider?: string;
  placeId?: string;
  reviewerId?: string;
  reviewId?: string;
  stars?: number | string;
  text?: string | null;
  publishedAt?: string | null;
  reviewerUrl?: string | null;
  reviewUrl?: string | null;
  businessUrl?: string | null;
  sourceRunId?: string | null;
};

type ShadowRow = {
  id: number;
  content_fingerprint: string;
  stars: number;
  comment: string | null;
  published_at: string | null;
  place_id: string;
  reviewer_id: string;
  provider_review_id: string;
  decision: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function fingerprint(stars: number, comment: string | null | undefined): string {
  return `${stars}|${normalizeText(comment).toLowerCase()}`;
}

function samePublishedAt(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 1000;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_not_configured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const rest = async (
    path: string,
    init?: RequestInit
  ): Promise<Response> =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        ...authHeaders,
        ...(init?.headers ?? {}),
      },
    });

  try {
    const body = (await req.json()) as IncomingReview;
    const provider = normalizeId(body.provider || "google").toLowerCase();
    const placeId = normalizeId(body.placeId);
    const reviewerId = normalizeId(body.reviewerId);
    const reviewId = normalizeId(body.reviewId);
    const stars = Number(body.stars);
    const comment = body.text ?? null;
    const publishedAt = body.publishedAt ? String(body.publishedAt) : null;

    if (
      provider !== "google" ||
      !placeId ||
      !reviewerId ||
      !reviewId ||
      !Number.isInteger(stars) ||
      stars < 1 ||
      stars > 5
    ) {
      return new Response(
        JSON.stringify({
          error: "invalid_payload",
          required: ["placeId", "reviewerId", "reviewId", "stars"],
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const contentFingerprint = fingerprint(stars, comment);
    const now = new Date().toISOString();

    const knownResponse = await rest(
      `review_identity_shadow_events?provider=eq.${encodeURIComponent(provider)}&provider_review_id=eq.${encodeURIComponent(reviewId)}&select=id,content_fingerprint,stars,comment,published_at,place_id,reviewer_id,provider_review_id,decision&order=last_seen_at.desc&limit=1`
    );

    if (!knownResponse.ok) {
      throw new Error(`known_review_lookup_failed:${knownResponse.status}`);
    }

    const knownRows = (await knownResponse.json()) as ShadowRow[];
    const known = knownRows[0];

    if (known?.content_fingerprint === contentFingerprint) {
      const touchResponse = await rest(
        `review_identity_shadow_events?id=eq.${known.id}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_seen_at: now }),
        }
      );

      if (!touchResponse.ok) {
        throw new Error(`shadow_touch_failed:${touchResponse.status}`);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          shadow: true,
          decision: "unchanged",
          reason: "known-review-id-same-content",
          matchedEventId: known.id,
        }),
        { headers: jsonHeaders }
      );
    }

    let decision: "new" | "edited" | "recreated" | "candidate";
    let reason: string;
    let matchedEventId: number | null = null;
    let evidence: Record<string, unknown> = {};

    if (known) {
      decision = "edited";
      reason = "known-review-id-content-changed";
      matchedEventId = known.id;
      evidence = {
        previousStars: known.stars,
        starsChanged: Number(known.stars) !== stars,
        sameProviderReviewId: true,
      };
    } else {
      const candidateResponse = await rest(
        `review_identity_shadow_events?provider=eq.${encodeURIComponent(provider)}&place_id=eq.${encodeURIComponent(placeId)}&reviewer_id=eq.${encodeURIComponent(reviewerId)}&select=id,content_fingerprint,stars,comment,published_at,place_id,reviewer_id,provider_review_id,decision&order=last_seen_at.desc&limit=20`
      );

      if (!candidateResponse.ok) {
        throw new Error(`candidate_lookup_failed:${candidateResponse.status}`);
      }

      const candidates = (await candidateResponse.json()) as ShadowRow[];

      if (candidates.length === 0) {
        decision = "new";
        reason = "no-reviewer-place-history";
      } else {
        const sameContent = candidates.find(
          (row) => row.content_fingerprint === contentFingerprint
        );
        const sameDate = candidates.find((row) =>
          samePublishedAt(row.published_at, publishedAt)
        );
        const strongest = sameContent ?? sameDate ?? candidates[0];

        matchedEventId = strongest.id;

        if (sameContent) {
          decision = "recreated";
          reason = "new-review-id-same-content";
          evidence = {
            sameContent: true,
            previousProviderReviewId: sameContent.provider_review_id,
          };
        } else if (sameDate) {
          decision = "recreated";
          reason = "new-review-id-same-published-at";
          evidence = {
            samePublishedAt: true,
            previousProviderReviewId: sameDate.provider_review_id,
            previousStars: sameDate.stars,
            starsChanged: Number(sameDate.stars) !== stars,
          };
        } else {
          decision = "candidate";
          reason = "same-reviewer-place-new-review-id-needs-reconciliation";
          evidence = {
            candidateCount: candidates.length,
            previousProviderReviewId: strongest.provider_review_id,
            previousStars: strongest.stars,
            starsChanged: Number(strongest.stars) !== stars,
          };
        }
      }
    }

    let restauranteId: number | null = null;
    const restaurantResponse = await rest(
      `restaurantes?place_id=eq.${encodeURIComponent(placeId)}&select=id&limit=2`
    );

    if (restaurantResponse.ok) {
      const restaurants = (await restaurantResponse.json()) as Array<{ id: number }>;
      if (restaurants.length === 1) restauranteId = restaurants[0].id;
    }

    const insertResponse = await rest("review_identity_shadow_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        provider,
        restaurante_id: restauranteId,
        place_id: placeId,
        reviewer_id: reviewerId,
        provider_review_id: reviewId,
        stars,
        comment,
        content_fingerprint: contentFingerprint,
        published_at: publishedAt,
        first_seen_at: now,
        last_seen_at: now,
        reviewer_url: body.reviewerUrl || null,
        review_url: body.reviewUrl || null,
        business_url: body.businessUrl || null,
        decision,
        reason,
        matched_event_id: matchedEventId,
        evidence,
        source: "make-shadow",
        source_run_id: body.sourceRunId || null,
      }),
    });

    if (!insertResponse.ok) {
      throw new Error(`shadow_insert_failed:${insertResponse.status}`);
    }

    const inserted = (await insertResponse.json()) as Array<{ id: number }>;

    return new Response(
      JSON.stringify({
        ok: true,
        shadow: true,
        decision,
        reason,
        eventId: inserted[0]?.id ?? null,
        matchedEventId,
      }),
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("[review-identity-shadow]", error);
    return new Response(
      JSON.stringify({
        error: "shadow_processing_failed",
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
