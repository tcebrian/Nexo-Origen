import { requireApiAuth } from "@/lib/auth/api-auth";
import { isValidDateKey } from "@/lib/dates/period";
import { loadCanonicalReports } from "@/lib/reports/canonical-reports.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");

  if (!startKey || !endKey || !isValidDateKey(startKey) || !isValidDateKey(endKey)) {
    return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  }

  try {
    const reports = await loadCanonicalReports({
      start: new Date(`${startKey}T00:00:00`),
      end: new Date(`${endKey}T23:59:59`),
      scope: auth.session.scope,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[api/reports/data]", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los informes." },
      { status: 500 }
    );
  }
}
