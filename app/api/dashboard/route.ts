import { isValidDateKey } from "@/lib/dates/period";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { getDashboardData } from "@/lib/supabase/dashboard-data";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");

  if (!startKey || !endKey) {
    return NextResponse.json({ error: "Parámetros start y end requeridos (YYYY-MM-DD)" }, { status: 400 });
  }

  if (!isValidDateKey(startKey) || !isValidDateKey(endKey)) {
    return NextResponse.json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" }, { status: 400 });
  }

  const data = await getDashboardData(startKey, endKey, auth.session.scope);
  return NextResponse.json(data);
}
