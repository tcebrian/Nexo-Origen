import { fetchDashboardKpisForPeriod } from "@/lib/supabase/dashboard-kpis";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import { getKpiDiarioTableCount } from "@/lib/supabase/kpi-diario.server";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { fetchMarcas } from "@/lib/supabase/marcas";
import { fetchRestaurantesCatalog } from "@/lib/supabase/restaurantes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabase } from "@/lib/supabase";

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TestSupabasePage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/dashboard");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const supabase = getSupabase();
  const dataClient = getSupabaseAdmin() ?? supabase;

  const [
    kpiRestaurantes,
    kpiDiarioCount,
    kpiDiarioAdminCount,
    resenasCount,
    restaurantes,
    marcas,
    dashboardKpisCount,
    kpiDiarioSample,
  ] = await Promise.all([
    fetchAllKpiRows().catch(() => []),
    getKpiDiarioTableCount(),
    dataClient.from("kpi_diario").select("*", { count: "exact", head: true }),
    supabase.from("resenas").select("*", { count: "exact", head: true }),
    fetchRestaurantesCatalog(),
    fetchMarcas(),
    dataClient.from("dashboard_kpis").select("*", { count: "exact", head: true }),
    dataClient.from("kpi_diario").select("*").order("fecha", { ascending: false }).limit(3),
  ]);

  const kpiSum = kpiRestaurantes.reduce((acc, row) => acc + row.total_resenas, 0);
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 90);
  const dashboardKpisSample = await fetchDashboardKpisForPeriod(
    weekAgo.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10)
  );
  const resenasLast90 = await fetchResenasForPeriodServer(
    { start: monthAgo, end: today },
    undefined
  );
  const resenasSample = await dataClient.from("resenas").select("*").limit(1);

  return (
    <main className="min-h-screen bg-[#05030A] p-8 text-white">
      <h1 className="text-2xl font-medium">Test Supabase</h1>
      <p className="mt-2 text-sm text-gray-400">Diagnóstico de tablas conectadas al dashboard</p>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-medium text-gray-300">Variables de entorno</h2>
        <ul className="mt-4 space-y-2 font-mono text-xs text-gray-400">
          <li>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl || "(vacía)"}</li>
          <li>ANON_KEY: {hasAnonKey ? "configurada" : "falta"}</li>
          <li>SERVICE_ROLE: {hasServiceRole ? "activa" : "no configurada"}</li>
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-medium text-gray-300">Conteos</h2>
        <ul className="mt-4 space-y-2 font-mono text-sm text-gray-300">
          <li>
            kpi_restaurantes (vista):{" "}
            <span className={kpiRestaurantes.length > 0 ? "text-emerald-400" : "text-amber-400"}>
              {kpiRestaurantes.length} filas
            </span>
            <span className="text-gray-500"> · solo GRANT SELECT, sin RLS</span>
          </li>
          <li>kpi_diario (anon): {kpiDiarioCount < 0 ? "error" : `${kpiDiarioCount} filas`}</li>
          <li>kpi_diario (servidor): {kpiDiarioAdminCount.count ?? 0} filas</li>
          <li>resenas: {resenasCount.count ?? 0} filas</li>
          <li>
            resenas (últimos 90 días):{" "}
            <span className={resenasLast90.length > 0 ? "text-emerald-400" : "text-amber-400"}>
              {resenasLast90.length} filas
            </span>
          </li>
          <li>restaurantes: {restaurantes.length} filas</li>
          <li>marcas: {marcas.length} filas</li>
          <li>dashboard_kpis: {dashboardKpisCount.count ?? 0} filas</li>
          <li className="text-gray-500">suma acumulada kpi_restaurantes: {kpiSum}</li>
        </ul>
        {dashboardKpisSample && (
          <p className="mt-4 text-sm text-emerald-300">
            dashboard_kpis periodo reciente: media {dashboardKpisSample.mediaGlobal.toFixed(2)},{" "}
            {dashboardKpisSample.totalResenas} reseñas
          </p>
        )}
        {kpiDiarioCount === 0 && (
          <p className="mt-4 text-sm text-amber-300">
            Ejecuta supabase/rls_policies.sql si las tablas tienen datos pero el conteo anon es 0.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-medium text-gray-300">Muestra resenas</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-gray-300">
          {JSON.stringify(resenasSample.data?.[0] ?? resenasSample.error, null, 2)}
        </pre>
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-medium text-gray-300">Muestra kpi_diario</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-gray-300">
          {JSON.stringify(kpiDiarioSample.data, null, 2)}
        </pre>
      </section>
    </main>
  );
}
