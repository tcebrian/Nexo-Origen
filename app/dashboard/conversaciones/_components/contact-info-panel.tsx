"use client";

import { useState, type ReactNode } from "react";
import type { ActivationError } from "./use-contact-detail";
import {
  WEB_ACCOUNT_LABELS,
  fetchJson,
  fieldClass,
  formatDateTime,
  pluralRestaurants,
  primaryButtonClass,
  secondaryButtonClass,
  type ContactDetail,
  type ContactOptions,
  type LinkableUser,
  type WhatsAppState,
} from "./shared";
import { WhatsAppStatusBadge, type WhatsAppBadgeState } from "./whatsapp-status-badge";

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function WhatsAppGlyph({ tone }: { tone: "active" | "sent" | "pending" | "error" }) {
  const color = {
    active: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    sent: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    pending: "border-white/[0.1] bg-white/[0.04] text-gray-400",
    error: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  }[tone];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${color}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.2 19.2 6.3 15.6A7.7 7.7 0 1 1 9.6 18.7L5.2 19.2Z" />
        <path d="M9.6 9.4c.3 2.2 2.6 4.4 4.8 4.8l1-1.1-1.7-1-.7.6c-.8-.3-1.5-1-1.8-1.8l.6-.7-1-1.7-1.2 1Z" />
      </svg>
    </span>
  );
}

/** Tarjeta de WhatsApp: estado de la activación y su acción (la misma llamada de siempre). */
function WhatsAppCard({
  conversationId,
  whatsapp,
  activationError,
  onActivated,
  onError,
}: {
  conversationId: string;
  whatsapp: WhatsAppState;
  activationError: ActivationError | null;
  onActivated: (whatsapp: WhatsAppState) => void;
  onError: (error: ActivationError | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /** Envío MANUAL de la plantilla de activación. Si falla no se reintenta solo: se vuelve a pulsar. */
  async function send() {
    setBusy(true);
    setNote(null);
    onError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/activation`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { whatsapp?: WhatsAppState; error?: string; code?: string; detail?: string }
        | null;
      if (!response.ok || !data?.whatsapp) {
        if (data?.code === "already_sent") {
          setNote("La activación ya se envió. El reenvío manual se habilitará en un próximo cambio.");
          return;
        }
        // Si Meta rechaza la plantilla, `error` trae el código ("… (Meta 132001)") y `detail` el motivo saneado.
        onError({ text: data?.error ?? "No se pudo enviar la activación", detail: data?.detail });
        return;
      }
      onActivated(data.whatsapp);
    } catch {
      onError({ text: "No se pudo enviar la activación" });
    } finally {
      setBusy(false);
    }
  }

  const badge: WhatsAppBadgeState = activationError ? "error" : whatsapp.state;

  return (
    <Card title="WhatsApp" action={<WhatsAppStatusBadge state={badge} />}>
      <div className="flex items-start gap-3">
        <WhatsAppGlyph tone={badge} />
        <div className="min-w-0 flex-1">
          {whatsapp.state === "active" ? (
            <>
              <p className="text-[13px] font-medium text-white">Servicio activo</p>
              <p className="mt-0.5 text-xs text-gray-400">Este contacto puede recibir información de Nexo.</p>
              <p className="mt-2 text-[11px] text-gray-500">Activado el {formatDateTime(whatsapp.activatedAt)}</p>
            </>
          ) : whatsapp.state === "sent" ? (
            <>
              <p className="text-[13px] font-medium text-white">Activación enviada</p>
              <p className="mt-0.5 text-xs text-gray-400">Esperando confirmación del contacto.</p>
              <p className="mt-2 text-[11px] text-gray-500">Enviada el {formatDateTime(whatsapp.welcomeSentAt)}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-white">Todavía no se ha enviado la activación</p>
              <p className="mt-0.5 text-xs text-gray-400">El contacto recibirá un mensaje para activar el servicio.</p>
            </>
          )}
        </div>
      </div>

      {activationError ? (
        <div role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3.5 py-3">
          <p className="text-[13px] font-medium text-rose-100">{activationError.text}</p>
          {activationError.detail ? <p className="mt-1 break-words text-xs text-rose-100/70">{activationError.detail}</p> : null}
        </div>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-gray-300">
          {note}
        </p>
      ) : null}

      {whatsapp.state === "pending" ? (
        <button type="button" onClick={() => void send()} disabled={busy} className={`${primaryButtonClass} mt-4 w-full`}>
          {busy ? "Enviando…" : "Enviar activación"}
        </button>
      ) : whatsapp.state === "sent" ? (
        <button type="button" onClick={() => void send()} disabled={busy} className={`${secondaryButtonClass} mt-4 w-full`}>
          {busy ? "Enviando…" : "Reenviar activación"}
        </button>
      ) : null}
    </Card>
  );
}

/** Resumen de permisos; el formulario completo vive en el drawer. */
function PermissionsCard({
  detail,
  config,
  onEdit,
}: {
  detail: ContactDetail;
  config: ContactOptions;
  onEdit: () => void;
}) {
  const empresa = config.options.empresas.find((item) => item.id === detail.selection.empresaId)?.nombre ?? null;
  const preview = detail.access.restaurants.slice(0, 4);
  const rest = detail.access.count - preview.length;

  return (
    <Card
      title="Permisos"
      action={
        <button type="button" onClick={onEdit} className="rounded-lg px-2 py-1 text-xs font-medium text-violet-300 transition hover:bg-white/[0.06] hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50">
          Editar permisos
        </button>
      }
    >
      <dl className="space-y-3 text-[13px]">
        <div>
          <dt className="text-[11px] text-gray-500">Empresa</dt>
          <dd className="mt-0.5 text-gray-100">{empresa ?? <span className="text-gray-500">Sin empresa</span>}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-500">Acceso</dt>
          <dd className="mt-0.5 text-gray-100">
            {detail.access.count === 0 ? (
              <span className="text-gray-500">Sin acceso a datos</span>
            ) : detail.selection.todosRestaurantes ? (
              `Todos los restaurantes (${detail.access.count})`
            ) : (
              pluralRestaurants(detail.access.count)
            )}
          </dd>
        </div>
      </dl>

      {preview.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-xs text-gray-300">
          {preview.map((restaurant) => (
            <li key={restaurant.id} className="truncate">
              {restaurant.name}
              {restaurant.brand ? <span className="text-gray-600"> · {restaurant.brand}</span> : null}
            </li>
          ))}
          {rest > 0 ? <li className="text-gray-500">y {rest} más</li> : null}
        </ul>
      ) : null}
    </Card>
  );
}

/** Cuenta web vinculada (opcional, informativa): no cambia los restaurantes del contacto. */
function LinkedAccountCard({
  conversationId,
  detail,
  onDetailChange,
}: {
  conversationId: string;
  detail: ContactDetail;
  onDetailChange: (detail: ContactDetail) => void;
}) {
  const [users, setUsers] = useState<LinkableUser[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(usuarioId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });
      const data = (await response.json().catch(() => null)) as (ContactDetail & { error?: string }) | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "No se pudo guardar el vínculo");
        return;
      }
      onDetailChange(data);
      setChoice("");
    } catch {
      setError("No se pudo guardar el vínculo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Cuenta web (opcional)">
      {detail.linkedUser ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <div className="min-w-0">
            <p className="truncate text-gray-100">{detail.linkedUser.nombre}</p>
            <p className="truncate text-xs text-gray-500">
              {WEB_ACCOUNT_LABELS[detail.linkedUser.rol] ?? detail.linkedUser.rol}
              {detail.linkedUser.empresaNombre ? ` · ${detail.linkedUser.empresaNombre}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void link(null)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-white/[0.06] hover:text-rose-300 disabled:opacity-40"
          >
            Desvincular
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            onFocus={() => {
              if (!users) {
                fetchJson<{ users: LinkableUser[] }>(`/api/conversations/${conversationId}/linkable-users`)
                  .then((data) => setUsers(data.users))
                  .catch(() => setError("No se pudieron cargar las cuentas."));
              }
            }}
            aria-label="Cuenta web vinculada"
            className={`${fieldClass} min-w-0 flex-1`}
          >
            <option value="">Ninguna</option>
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id} disabled={user.linkedElsewhere}>
                {user.nombre} · {WEB_ACCOUNT_LABELS[user.rol] ?? user.rol}
                {user.linkedElsewhere ? " (ya vinculada a otro teléfono)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || choice === ""}
            onClick={() => void link(choice)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-white/[0.06] disabled:opacity-40"
          >
            Vincular
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-gray-600">Solo informativo: no cambia los restaurantes de este contacto.</p>
    </Card>
  );
}

/**
 * Interruptor "Reseñas negativas": si el contacto recibe automáticamente por WhatsApp las reseñas de 1⭐ y 2⭐
 * de SUS restaurantes. No concede acceso: el alcance sigue saliendo de empresa y restaurantes asignados.
 */
function NegativeAlertsCard({
  conversationId,
  enabled,
  onChange,
}: {
  conversationId: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/negative-alerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await response.json().catch(() => null)) as { enabled?: boolean; error?: string } | null;
      if (!response.ok || typeof data?.enabled !== "boolean") {
        setError(data?.error ?? "No se pudo guardar el cambio");
        return;
      }
      onChange(data.enabled);
    } catch {
      setError("No se pudo guardar el cambio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Reseñas negativas"
      action={
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            enabled ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/[0.1] text-gray-400"
          }`}
        >
          {enabled ? "Activado" : "Desactivado"}
        </span>
      }
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-xs text-gray-400">
          Recibir automáticamente por WhatsApp las reseñas de 1⭐ y 2⭐ de sus restaurantes.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Reseñas negativas"
          disabled={busy}
          onClick={() => void toggle()}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:opacity-60 ${
            enabled ? "border-emerald-400/40 bg-emerald-400/30" : "border-white/[0.12] bg-white/[0.06]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * PRUEBA TEMPORAL (solo super_admin: toda la pantalla lo es): envía `informe_diario` o `alerta_negativa`
 * a este contacto por el mismo sistema de envío de Conversations, para comprobar que Meta las acepta.
 * No cambia la activación ni los permisos. Se retirará cuando termine la validación.
 */
function TemplateTestCard({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const [busy, setBusy] = useState<"daily_report" | "negative_alert" | "negative_alert_template" | null>(null);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string; detail?: string } | null>(null);

  async function run(kind: "daily_report" | "negative_alert" | "negative_alert_template") {
    setBusy(kind);
    setResult(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/template-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Un id nuevo por pulsación: un doble clic no duplica, una pulsación nueva envía otro mensaje.
        body: JSON.stringify({ kind, requestId: crypto.randomUUID() }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
      if (!response.ok) {
        setResult({ kind: "error", text: data?.error ?? "No se pudo enviar la plantilla de prueba", detail: data?.detail });
        return;
      }
      setResult({ kind: "ok", text: "Plantilla enviada. Mira el estado de entrega en la conversación." });
      onSent();
    } catch {
      setResult({ kind: "error", text: "No se pudo enviar la plantilla de prueba" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-dashed border-amber-300/25 bg-amber-300/[0.04] p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">Prueba de plantillas</h3>
        <span className="rounded-full border border-amber-300/25 px-2 py-0.5 text-[10px] font-medium text-amber-200">Temporal</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Envía una plantilla real a este contacto. El informe diario ejecuta el flujo real (restaurantes asignados, informe de hoy y
        snapshot), así que «Ver informe» funciona. Las alertas usan la reseña negativa más reciente de sus restaurantes: con la
        ventana de 24 h abierta llegan directas (imagen + enlace); «forzar plantilla» envía el aviso para probar «Ver alerta». No
        cambia su activación ni sus permisos.
      </p>
      <div className="grid gap-2">
        <button type="button" onClick={() => void run("daily_report")} disabled={busy !== null} className={secondaryButtonClass}>
          {busy === "daily_report" ? "Enviando…" : "Probar informe diario"}
        </button>
        <button type="button" onClick={() => void run("negative_alert")} disabled={busy !== null} className={secondaryButtonClass}>
          {busy === "negative_alert" ? "Enviando…" : "Probar alerta negativa"}
        </button>
        <button type="button" onClick={() => void run("negative_alert_template")} disabled={busy !== null} className={secondaryButtonClass}>
          {busy === "negative_alert_template" ? "Enviando…" : "Probar alerta (forzar plantilla)"}
        </button>
      </div>
      {result ? (
        <div
          role={result.kind === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-3 py-2.5 text-xs ${
            result.kind === "ok" ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100" : "border-rose-400/20 bg-rose-400/[0.07] text-rose-100"
          }`}
        >
          <p className="font-medium">{result.text}</p>
          {result.detail ? <p className="mt-1 break-words opacity-80">{result.detail}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Columna de información del contacto (derecha en pantallas anchas; en drawer en las demás). */
export function ContactInfoPanel({
  conversationId,
  detail,
  config,
  activationError,
  onDetailChange,
  onActivationError,
  onChanged,
  onEditPermissions,
}: {
  conversationId: string;
  detail: ContactDetail | null;
  config: ContactOptions | null;
  activationError: ActivationError | null;
  onDetailChange: (detail: ContactDetail) => void;
  onActivationError: (error: ActivationError | null) => void;
  onChanged: () => void;
  onEditPermissions: () => void;
}) {
  if (!detail || !config) {
    return <p className="px-1 py-6 text-center text-xs text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-3">
      <WhatsAppCard
        conversationId={conversationId}
        whatsapp={detail.whatsapp}
        activationError={activationError}
        onActivated={(whatsapp) => {
          onDetailChange({ ...detail, whatsapp });
          onChanged();
        }}
        onError={onActivationError}
      />
      <PermissionsCard detail={detail} config={config} onEdit={onEditPermissions} />
      <NegativeAlertsCard
        conversationId={conversationId}
        enabled={detail.negativeAlerts}
        onChange={(negativeAlerts) => onDetailChange({ ...detail, negativeAlerts })}
      />
      <LinkedAccountCard conversationId={conversationId} detail={detail} onDetailChange={onDetailChange} />
      <TemplateTestCard conversationId={conversationId} onSent={onChanged} />
    </div>
  );
}
