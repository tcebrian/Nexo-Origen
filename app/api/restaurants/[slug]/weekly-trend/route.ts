import { isRestauranteSlugInScope } from "@/lib/auth/restaurant-guard";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import {
  buildWeeklyMediaTrend,
  resolveTrendWindowRange,
  type TrendWindowMode,
} from "@/lib/restaurants/weekly-media-trend";
import { loadPeriodDataServer } from "@/lib/supabase/period-api.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODES: TrendWindowMode[] = ["month", "quarter", "semester"];

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { slug } = await context.params;
  if (!(await isRestauranteSlugInScope(auth.session.scope, slug))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const modeParam = searchParams.get("mode") ?? "month";
  const mode = MODES.includes(modeParam as TrendWindowMode) ? (modeParam as TrendWindowMode) : "month";
  const offset = Number(searchParams.get("offset") ?? "0");
  const safeOffset = Number.isFinite(offset) ? offset : 0;

  const window = resolveTrendWindowRange(mode, safeOffset);

  try {
    const period = await loadPeriodDataServer(window.start, window.end, auth.session.scope);
    const catalogRow = period.catalog.find((item) => restaurantSlug(item.restaurante) === slug);

    if (!catalogRow) {
      return NextResponse.json({
        weeks: [],
        title: window.title,
        mode: window.mode,
        offset: safeOffset,
        canGoForward: safeOffset < 0,
      });
    }

    const weeks = buildWeeklyMediaTrend(
      period.resenas,
      catalogRow.restaurante_id,
      window.start,
      window.end,
      period.kpiDiarioRows
    );

    return NextResponse.json({
      weeks,
      title: window.title,
      mode: window.mode,
      offset: safeOffset,
      canGoForward: safeOffset < 0,
    });
  } catch (error) {
    console.error("[api/restaurants/weekly-trend]", error);
    return NextResponse.json({ error: "Error al cargar la evolución semanal" }, { status: 500 });
  }
}
