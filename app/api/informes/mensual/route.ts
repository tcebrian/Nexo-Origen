import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { listMonthlyRestaurants } from "@/lib/reports/monthly/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const brand = url.searchParams.get("brand")?.trim();
  const offset = Number(url.searchParams.get("offset") ?? "0");
  if (!brand || brand.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 35) {
    return NextResponse.json({ error: "Marca o mes no válido" }, { status: 400 });
  }
  try {
    const result = await listMonthlyRestaurants(brand, offset, auth.session.scope);
    if (!result.restaurants.length) return NextResponse.json({ error: "Marca no disponible" }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[api/informes/mensual]", error);
    return NextResponse.json({ error: "No se pudieron cargar los restaurantes" }, { status: 500 });
  }
}
