import { requireApiAuth } from "@/lib/auth/api-auth";
import { computeWeeklyContext } from "@/lib/reports/negative-reviews/weekly-context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const restauranteIdRaw = searchParams.get("restauranteId");
  const reviewDate = searchParams.get("reviewDate");

  const restauranteId = restauranteIdRaw ? Number(restauranteIdRaw) : NaN;
  if (!Number.isFinite(restauranteId) || !reviewDate) {
    return NextResponse.json(
      { error: "Parámetros restauranteId y reviewDate requeridos" },
      { status: 400 }
    );
  }

  try {
    const context = await computeWeeklyContext(restauranteId, reviewDate);
    return NextResponse.json(context);
  } catch (error) {
    console.error("[api/informes/weekly-context]", error);
    return NextResponse.json({ error: "No se pudo calcular el contexto semanal" }, { status: 500 });
  }
}
