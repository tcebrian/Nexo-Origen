import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { filterBrandIdsByScope } from "@/lib/auth/brand-scope";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { buildNegativeReviewReportRows } from "@/lib/reports/negative-reviews/build-rows";
import { SUPPORTED_NEGATIVE_REVIEW_BRANDS } from "@/lib/reports/negative-reviews/templates";
import { getPeriodData } from "@/lib/supabase/period-stats";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("start");
  const endKey = searchParams.get("end");
  const brand = searchParams.get("brand") ?? "bk";
  const limitRaw = searchParams.get("limit");

  if (!startKey || !endKey) {
    return NextResponse.json({ error: "Parámetros start y end requeridos" }, { status: 400 });
  }

  const limit = limitRaw ? Number(limitRaw) : 50;

  try {
    const scope = auth.session.scope;
    const period = await getPeriodData(startKey, endKey, scope);
    const scopedSupported = filterBrandIdsByScope(scope, SUPPORTED_NEGATIVE_REVIEW_BRANDS);

    const brands: BrandId[] =
      brand === "all"
        ? scopedSupported
        : scopedSupported.includes(brand as BrandId)
          ? [brand as BrandId]
          : scopedSupported;

    const rows = buildNegativeReviewReportRows(period, {
      start: new Date(`${startKey}T12:00:00`),
      end: new Date(`${endKey}T12:00:00`),
      brands,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({
      fetchedAt: period.fetchedAt.toISOString(),
      count: rows.length,
      brandScope: brand,
      rows,
    });
  } catch (error) {
    console.error("[api/informes/negative-reviews]", error);
    return NextResponse.json({ error: "No se pudieron cargar las reseñas negativas" }, { status: 500 });
  }
}
