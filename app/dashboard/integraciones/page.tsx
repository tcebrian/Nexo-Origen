import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getIntegrationStatusSnapshot } from "@/lib/integrations/status";
import type { IntegrationStatus } from "@/lib/integrations/status-types";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "Sin datos";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin datos";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function statusMeta(status: IntegrationStatus | "missing") {
  switch (status) {
    case "connected":
      return {
        label: "Conectado",
        dot: "bg-emerald-400",
        className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      };
    case "syncing":
      return {
        label: "Sincronizando",
        dot: "bg-cyan-400",
        className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
      };
    case "pending":
      return {
        label: "Pendiente",
        dot: "bg-amber-400",
        className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
      };
    case "error":
      return {
        label: "Error",
        dot: "bg-rose-400",
        className: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      };
    case "disabled":
      return {
        label: "Desactivado",
        dot: "bg-gray-500",
        className: "border-white/[0.08] bg-white/[0.03] text-gray-400",
      };
    default:
      return {
        label: "Sin registrar",
        dot: "bg-gray-600",
        className: "border-white/[0.08] bg-white/[0.03] text-gray-500",
      };
  }
}

function StatusPill({ status }: { status: IntegrationStatus | "missing" }) {
  const meta = statusMeta(status);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default async function IntegrationsPage() {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    redirect("/dashboard");
  }

  const snapshot = await getIntegrationStatusSnapshot();
  const issues = snapshot.restaurants.filter((restaurant) => restaurant.issue);

  const cards = [
    {
      label: "Restaurantes activos",
      value: snapshot.activeRestaurants,
      detail: "Locales que Nexo considera activos",
    },
    {
      label: "Google Maps",
      value: `${snapshot.googleConnected}/${snapshot.activeRestaurants}`,
      detail:
        snapshot.googlePending === 0
          ? "Todos registrados"
          : `${snapshot.googlePending} pendientes`,
    },
    {
      label: "Apify",
      value: `${snapshot.apifyConnected}/${snapshot.activeRestaurants}`,
      detail:
        snapshot.apifyErrors > 0
          ? `${snapshot.apifyErrors} con error`
          : snapshot.apifyPending > 0
            ? `${snapshot.apifyPending} pendientes`
            : "Todos conectados",
    },
    {
      label: "Agentes",
      value: snapshot.activeAgents,
      detail: `${snapshot.pilotAgents} en modo piloto`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200">
              Nexo Control
            </span>
            <span className="text-xs text-gray-600">Estado del sistema</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Integraciones
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Comprueba desde Nexo qué está conectado, qué queda pendiente y dónde
            necesitas actuar sin entrar en Supabase o revisar configuración técnica.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-gray-600">
            Último dato de reseñas recibido
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {formatDateTime(snapshot.lastReviewIngestionAt)}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
          >
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
            <p className="mt-1 text-[11px] text-gray-600">{card.detail}</p>
          </div>
        ))}
      </section>

      <section
        className={`rounded-2xl border p-4 ${
          issues.length === 0
            ? "border-emerald-400/15 bg-emerald-400/[0.05]"
            : "border-amber-400/15 bg-amber-400/[0.05]"
        }`}
      >
        {issues.length === 0 ? (
          <>
            <p className="text-sm font-medium text-emerald-200">
              Todo lo registrado está conectado
            </p>
            <p className="mt-1 text-xs text-emerald-100/60">
              No hay integraciones pendientes ni errores registrados en los restaurantes activos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-amber-200">
              {issues.length} restaurante{issues.length === 1 ? "" : "s"} requieren atención
            </p>
            <p className="mt-1 text-xs text-amber-100/60">
              Los tienes destacados en la tabla para saber exactamente qué falta.
            </p>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <p className="text-sm font-medium text-white">Restaurantes e integraciones</p>
          <p className="mt-1 text-xs text-gray-500">
            “Último dato Apify” significa la última reseña guardada desde esa fuente; no
            implica por sí solo un fallo si el local no ha recibido reseñas nuevas.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.08em] text-gray-600">
                <th className="px-5 py-3 font-medium">Restaurante</th>
                <th className="px-4 py-3 font-medium">Google Maps</th>
                <th className="px-4 py-3 font-medium">Apify</th>
                <th className="px-4 py-3 font-medium">Último dato Apify</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.restaurants.map((restaurant) => (
                <tr
                  key={restaurant.restaurantId}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-white">
                      {restaurant.restaurantName}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {restaurant.city || "Sin ciudad"} · ID {restaurant.restaurantId}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill status={restaurant.googleMaps} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill status={restaurant.apify} />
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {formatDateTime(restaurant.lastApifyDataAt)}
                  </td>
                  <td className="px-5 py-4">
                    {restaurant.issue ? (
                      <span className="text-xs text-amber-200">{restaurant.issue}</span>
                    ) : (
                      <span className="text-xs text-emerald-300">Correcto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
