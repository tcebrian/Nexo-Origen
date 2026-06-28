import { isValidDateKey } from "@/lib/dates/period";
import { getDashboardOverviewServer } from "@/lib/services/dashboard.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function serializeOverview(data: Awaited<ReturnType<typeof getDashboardOverviewServer>>) {
  return {
    ...data,
    urgentAlerts: data.urgentAlerts.map((a) => ({
      ...a,
      detectedAt: a.detectedAt.toISOString(),
    })),
    recentActivity: data.recentActivity.map((a) => ({
      ...a,
      occurredAt: a.occurredAt.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");

  if (!startKey || !endKey) {
    return NextResponse.json(
      { error: "Parámetros start y end requeridos (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!isValidDateKey(startKey) || !isValidDateKey(endKey)) {
    return NextResponse.json({ error: "Formato de fecha inválido" }, { status: 400 });
  }

  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T23:59:59`);

  try {
    const overview = await getDashboardOverviewServer({
      tenantId: "grupo-hambar",
      start,
      end,
    });
    return NextResponse.json(serializeOverview(overview));
  } catch (error) {
    console.error("[api/platform/overview]", error);
    return NextResponse.json({ error: "No se pudo cargar el resumen" }, { status: 500 });
  }
}
