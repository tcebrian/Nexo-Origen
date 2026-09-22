"use client";

import { useMemo, useState } from "react";
import type {
  AgentControlItem,
  AgentControlSnapshot,
  AgentMode,
} from "@/lib/agents/types";

function formatDateTime(value: string | null): string {
  if (!value) return "Sin actividad todavía";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad todavía";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function modeLabel(mode: AgentMode) {
  if (mode === "activo") return "Activo";
  if (mode === "pausado") return "Pausado";
  return "Piloto";
}

function statusClass(agent: AgentControlItem) {
  if (!agent.activo || agent.modo === "pausado") {
    return "border-white/[0.08] bg-white/[0.03] text-gray-400";
  }
  if (agent.modo === "piloto") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
}

function ConnectionNode({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-w-[150px] rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-[11px] text-gray-500">{subtitle}</p>
    </div>
  );
}

export function AgentControlView({
  initialSnapshot,
}: {
  initialSnapshot: AgentControlSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const active = snapshot.agents.filter(
      (agent) => agent.activo && agent.modo !== "pausado"
    ).length;
    const pilots = snapshot.agents.filter((agent) => agent.modo === "piloto").length;
    const conversations = snapshot.agents.reduce(
      (sum, agent) => sum + agent.conversationCount,
      0
    );

    return {
      total: snapshot.agents.length,
      active,
      pilots,
      conversations,
    };
  }, [snapshot.agents]);

  function updateLocalAgent(
    id: string,
    updater: (agent: AgentControlItem) => AgentControlItem
  ) {
    setSnapshot((current) => ({
      ...current,
      agents: current.agents.map((agent) =>
        agent.id === id ? updater(agent) : agent
      ),
    }));
  }

  async function saveAgent(agent: AgentControlItem) {
    setSavingId(agent.id);
    setFeedback((current) => ({ ...current, [agent.id]: "" }));

    try {
      const response = await fetch("/api/agents/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          todosRestaurantes: agent.todosRestaurantes,
          restauranteIds: agent.restauranteIds,
          activo: agent.activo,
          alertas: agent.alertas,
          modo: agent.modo,
          resumenDiario: agent.resumenDiario,
          resumenHora: agent.resumenHora,
          timezone: agent.timezone,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "No se pudo guardar.");
      }

      setSnapshot(body as AgentControlSnapshot);
      setFeedback((current) => ({
        ...current,
        [agent.id]: "Configuración guardada.",
      }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [agent.id]:
          error instanceof Error ? error.message : "No se pudo guardar.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200">
              Nexo Control
            </span>
            <span className="text-xs text-gray-600">V1 · Supervisores</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Centro de Agentes
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Visualiza quién tiene acceso al asistente, qué restaurantes puede consultar
            y qué automatizaciones tiene preparadas sin entrar en Make o Supabase.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-sm text-gray-500"
          title="La alta automática se conectará en la siguiente fase."
        >
          + Añadir agente · siguiente fase
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Agentes configurados", String(stats.total)],
          ["Operativos", String(stats.active)],
          ["En piloto", String(stats.pilots)],
          ["Conversaciones", String(stats.conversations)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-white">Cómo está conectado hoy</p>
          <p className="mt-1 text-xs text-gray-500">
            Esta es la arquitectura V1 real. Iremos moviendo configuración de Make a
            Nexo sin apagar lo que ya funciona.
          </p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          <ConnectionNode title="Supervisor" subtitle="Pregunta por WhatsApp" />
          <div className="flex items-center text-gray-700">→</div>
          <ConnectionNode title="WhatsApp Cloud" subtitle="Canal de entrada y salida" />
          <div className="flex items-center text-gray-700">→</div>
          <ConnectionNode title="Make" subtitle="Orquestación V1" />
          <div className="flex items-center text-gray-700">→</div>
          <ConnectionNode title="Supabase" subtitle="Permisos, memoria y datos" />
          <div className="flex items-center text-gray-700">→</div>
          <ConnectionNode title="Nexo / IA" subtitle="Consulta, analiza y responde" />
        </div>
      </section>

      <section className="grid gap-5 2xl:grid-cols-2">
        {snapshot.agents.map((agent) => {
          const selected = new Set(agent.restauranteIds);

          return (
            <article
              key={agent.id}
              className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 shadow-2xl"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{agent.nombre}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(
                        agent
                      )}`}
                    >
                      {agent.activo ? modeLabel(agent.modo) : "Desactivado"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Última actividad: {formatDateTime(agent.lastActivity)}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {agent.conversationCount} conversaciones registradas
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateLocalAgent(agent.id, (current) => ({
                      ...current,
                      activo: !current.activo,
                    }))
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    agent.activo
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/[0.08] bg-white/[0.03] text-gray-400"
                  }`}
                >
                  {agent.activo ? "Agente habilitado" : "Agente deshabilitado"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium text-gray-400">Modo</span>
                  <select
                    value={agent.modo}
                    onChange={(event) =>
                      updateLocalAgent(agent.id, (current) => ({
                        ...current,
                        modo: event.target.value as AgentMode,
                      }))
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0b0911] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-violet-400/30"
                  >
                    <option value="piloto">Piloto</option>
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-gray-400">
                    Alertas automáticas
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateLocalAgent(agent.id, (current) => ({
                        ...current,
                        alertas: !current.alertas,
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      agent.alertas
                        ? "border-violet-400/25 bg-violet-500/10 text-violet-200"
                        : "border-white/[0.08] bg-[#0b0911] text-gray-500"
                    }`}
                  >
                    {agent.alertas ? "Activadas" : "Desactivadas"}
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Restaurantes permitidos</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Esto define los locales que el agente puede consultar.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={agent.todosRestaurantes}
                      onChange={(event) =>
                        updateLocalAgent(agent.id, (current) => ({
                          ...current,
                          todosRestaurantes: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-violet-500"
                    />
                    Todos
                  </label>
                </div>

                {!agent.todosRestaurantes ? (
                  <div className="mt-4 max-h-44 space-y-2 overflow-y-auto pr-1">
                    {snapshot.restaurants.map((restaurant) => {
                      const checked = selected.has(restaurant.id);

                      return (
                        <label
                          key={restaurant.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              updateLocalAgent(agent.id, (current) => {
                                const next = new Set(current.restauranteIds);
                                if (event.target.checked) next.add(restaurant.id);
                                else next.delete(restaurant.id);

                                return {
                                  ...current,
                                  restauranteIds: Array.from(next).sort((a, b) => a - b),
                                };
                              })
                            }
                            className="h-4 w-4 accent-violet-500"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs text-gray-300">
                              {restaurant.nombre}
                            </span>
                            <span className="block truncate text-[10px] text-gray-600">
                              {restaurant.ciudad || "Sin ciudad"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-violet-400/10 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-200/80">
                    Puede consultar toda la red.
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Resumen diario</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Guardamos ya esta configuración en Nexo. El envío automático por
                      WhatsApp se conecta en el siguiente paso.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={agent.resumenDiario}
                    onChange={(event) =>
                      updateLocalAgent(agent.id, (current) => ({
                        ...current,
                        resumenDiario: event.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-violet-500"
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs text-gray-500">Hora</span>
                    <input
                      type="time"
                      value={agent.resumenHora}
                      disabled={!agent.resumenDiario}
                      onChange={(event) =>
                        updateLocalAgent(agent.id, (current) => ({
                          ...current,
                          resumenHora: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0b0911] px-3 py-2.5 text-sm text-gray-200 disabled:opacity-40"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs text-gray-500">Zona horaria</span>
                    <select
                      value={agent.timezone}
                      disabled={!agent.resumenDiario}
                      onChange={(event) =>
                        updateLocalAgent(agent.id, (current) => ({
                          ...current,
                          timezone: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0b0911] px-3 py-2.5 text-sm text-gray-200 disabled:opacity-40"
                    >
                      <option value="Europe/Madrid">Europe/Madrid</option>
                      <option value="Europe/Andorra">Europe/Andorra</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                <p
                  className={`text-xs ${
                    feedback[agent.id]?.includes("guardada")
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {feedback[agent.id] || "Los cambios no se aplican hasta guardar."}
                </p>

                <button
                  type="button"
                  disabled={savingId === agent.id}
                  onClick={() => saveAgent(agent)}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {savingId === agent.id ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
