import { requireApiAuth } from "@/lib/auth/api-auth";
import { assertRestauranteInScope } from "@/lib/auth/data-scope";
import { fetchAnalisisIaByReviewId } from "@/lib/supabase/analisis-ia.server";
import { fetchResenaRestauranteIdByReviewId } from "@/lib/supabase/resenas.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get("review_id");

  if (!reviewId?.trim()) {
    return NextResponse.json({ error: "Parámetro review_id requerido" }, { status: 400 });
  }

  const restauranteId = await fetchResenaRestauranteIdByReviewId(reviewId);
  if (
    restauranteId != null &&
    !assertRestauranteInScope(auth.session.scope, restauranteId)
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {    const { analisis, error } = await fetchAnalisisIaByReviewId(reviewId);
    if (error) {
      return NextResponse.json({ analisis: null, error }, { status: 500 });
    }
    return NextResponse.json({ analisis, error: null });
  } catch (err) {
    console.error("[api/analisis-ia]", err);
    return NextResponse.json(
      { analisis: null, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
