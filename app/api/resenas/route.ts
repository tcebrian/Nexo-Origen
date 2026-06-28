import { requireApiAuth } from "@/lib/auth/api-auth";
import { filterResenasByScope, assertRestauranteInScope } from "@/lib/auth/data-scope";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");
  const restauranteIdRaw = searchParams.get("restaurante_id");
  const restaurantSlug = searchParams.get("restaurant_slug") ?? undefined;

  if (!startKey || !endKey) {
    return NextResponse.json({ error: "Parámetros start y end requeridos" }, { status: 400 });
  }

  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  const restauranteId =
    restauranteIdRaw != null && restauranteIdRaw !== ""
      ? Number(restauranteIdRaw)
      : undefined;

  if (
    restauranteId != null &&
    Number.isFinite(restauranteId) &&
    !assertRestauranteInScope(auth.session.scope, restauranteId)
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const rows = await fetchResenasForPeriodServer(
      { start, end },
      {
        restauranteId: Number.isFinite(restauranteId) ? restauranteId : undefined,
        restaurantSlug,
      }
    );
    return NextResponse.json(filterResenasByScope(rows, auth.session.scope));
  } catch (error) {
    console.error("[api/resenas]", error);
    return NextResponse.json({ error: "No se pudieron cargar las reseñas" }, { status: 500 });
  }
}
