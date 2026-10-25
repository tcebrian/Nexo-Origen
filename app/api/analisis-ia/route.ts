import { requireApiAuth } from "@/lib/auth/api-auth";
import { assertRestauranteInScope } from "@/lib/auth/data-scope";
import { fetchAnalisisIaByReviewId } from "@/lib/supabase/analisis-ia.server";
import { resolveReviewRestaurant } from "@/lib/supabase/resenas.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Los review_id de Google miden unas decenas de caracteres; esto solo corta entradas absurdas. */
const MAX_REVIEW_ID_LENGTH = 200;

const fail = (status: number, error: string) =>
  NextResponse.json({ analisis: null, error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Análisis IA de una reseña. FALLA CERRADA (SEC-007): antes de tocar `analisis_ia` el servidor tiene que demostrar
 *   review_id → reseña real (inequívoca) → restaurante → permiso del usuario.
 * Si cualquier paso no se puede demostrar, no se devuelve nada. Eso incluye a super_admin: su alcance no filtra por
 * restaurante, pero tampoco puede leer análisis huérfanos (sin reseña o sin restaurante verificable).
 */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const reviewId = new URL(request.url).searchParams.get("review_id")?.trim() ?? "";
  if (!reviewId || reviewId.length > MAX_REVIEW_ID_LENGTH) {
    return fail(400, "Parámetro review_id requerido");
  }

  const resolved = await resolveReviewRestaurant(reviewId);
  if (!resolved.ok) {
    switch (resolved.reason) {
      case "not_found":
      case "no_restaurant":
        return fail(404, "Reseña no disponible");
      case "ambiguous":
        console.error("[api/analisis-ia] review_id ambiguo: varias reseñas comparten identificador");
        return fail(409, "No se pudo verificar la reseña");
      default:
        console.error("[api/analisis-ia] no se pudo resolver el restaurante de la reseña");
        return fail(503, "No se pudo verificar el acceso");
    }
  }

  if (!assertRestauranteInScope(auth.session.scope, resolved.restauranteId)) {
    return fail(403, "No autorizado");
  }

  try {
    const { analisis, error } = await fetchAnalisisIaByReviewId(reviewId);
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
