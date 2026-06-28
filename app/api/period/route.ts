import { isValidDateKey } from "@/lib/dates/period";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { logAnalisisIaJoinStats } from "@/lib/supabase/analisis-ia";
import { serializePeriodData } from "@/lib/supabase/period-api";
import { getPeriodData } from "@/lib/supabase/period-stats";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");

  if (!startKey || !endKey) {
    return NextResponse.json({ error: "Parámetros start y end requeridos" }, { status: 400 });
  }

  if (!isValidDateKey(startKey) || !isValidDateKey(endKey)) {
    return NextResponse.json({ error: "Formato de fecha inválido" }, { status: 400 });
  }

  try {
    const data = await getPeriodData(startKey, endKey, auth.session.scope);
    logAnalisisIaJoinStats(data.resenas, data.analisisByResenaId, "api/period");
    return NextResponse.json(serializePeriodData(data));
  } catch (error) {
    console.error("[api/period]", error);
    return NextResponse.json({ error: "Error al cargar periodo" }, { status: 500 });
  }
}
