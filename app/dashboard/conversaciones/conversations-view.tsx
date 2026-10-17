"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canSubmitDraft } from "@/lib/conversations/compose";
import { contactTypeLabel } from "@/lib/conversations/contact-access";
import { describeDeliveryStatus, type DeliveryIndicator } from "@/lib/conversations/delivery-status";
import {
  MAX_OUTBOUND_TEXT_CHARS,
  WHATSAPP_TEXT_MAX_CHARS,
  countMessageParts,
  textLength,
} from "@/lib/conversations/text-chunks";
import type { ReportFormat, ReportOptions, ReportTypeId } from "@/lib/conversations/report-catalog";
import { ContactInfoPanel } from "./_components/contact-info-panel";
import { Drawer } from "./_components/drawer";
import { NewContactDrawer } from "./_components/new-contact-drawer";
import { PermissionsDrawer } from "./_components/permissions-drawer";
import { brandsOf, formatPhone, initialsOf, pluralRestaurants } from "./_components/shared";
import { useContactDetail } from "./_components/use-contact-detail";
import { WhatsAppStatusBadge, type WhatsAppBadgeState } from "./_components/whatsapp-status-badge";
import {
  filterConversations,
  type ConversationListItem,
  type ConversationMessage,
} from "@/lib/conversations/read-model";

const LIST_POLL_MS = 15_000;
const MESSAGES_POLL_MS = 8_000;

const timeFormat = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});
const dayFormat = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Madrid",
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
const dayLongFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
});

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hora si es hoy; si no, día corto. */
function formatListTime(value: string | null): string {
  const date = parseDate(value);
  if (!date) return "";
  return dayKeyFormat.format(date) === dayKeyFormat.format(new Date())
    ? timeFormat.format(date)
    : dayFormat.format(date);
}

function formatMessageTime(value: string): string {
  const date = parseDate(value);
  return date ? timeFormat.format(date) : "";
}

function dayKey(value: string): string {
  const date = parseDate(value);
  return date ? dayKeyFormat.format(date) : "";
}

function formatDayLabel(value: string): string {
  const date = parseDate(value);
  return date ? dayLongFormat.format(date) : "";
}

const STATUS_LABEL = { open: "Abierta", closed: "Cerrada" } as const;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as T;
}

/** Ejecuta `task` cada `ms` mientras la pestaña esté visible. */
function useSoftPolling(task: () => void, ms: number, enabled: boolean) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") taskRef.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border border-violet-400/25 bg-gradient-to-br from-violet-500/25 to-violet-700/15 font-semibold text-violet-100 ${
        size === "lg" ? "h-12 w-12 text-[15px]" : "h-10 w-10 text-[13px]"
      }`}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/** Hace menos de 24 h que hubo actividad en la conversación. */
function isRecentActivity(value: string | null): boolean {
  const date = parseDate(value);
  return date !== null && Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
}

function ConversationRow({
  item,
  active,
  onSelect,
}: {
  item: ConversationListItem;
  active: boolean;
  onSelect: () => void;
}) {
  const role = item.access.state === "granted" ? contactTypeLabel(item.access.tipo) : null;
  const recent = isRecentActivity(item.lastMessageAt);

  return (
    <li className="px-2 py-0.5">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        title={item.lastMessagePreview ?? "Sin mensajes"}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 ${
          active
            ? "border-violet-400/35 bg-violet-500/[0.14] shadow-[0_0_24px_rgba(124,58,237,0.12)]"
            : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.04]"
        }`}
      >
        <Avatar name={item.displayName} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-white">{item.displayName}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-gray-500">
              {recent ? <span className="h-1.5 w-1.5 rounded-full bg-violet-400" title="Actividad reciente" aria-label="Actividad reciente" /> : null}
              {formatListTime(item.lastMessageAt)}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-400">
            {item.access.state === "granted" ? (
              <>
                {role ? `${role} · ` : ""}
                {pluralRestaurants(item.access.restaurantCount)}
              </>
            ) : (
              <span className="text-gray-600">Sin acceso a datos</span>
            )}
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <WhatsAppStatusBadge state={item.whatsapp} variant="inline" />
            {item.status === "closed" ? (
              <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-gray-500">
                Cerrada
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

const TONE_CLASS: Record<DeliveryIndicator["tone"], string> = {
  muted: "text-gray-500",
  read: "text-violet-300",
  warning: "text-amber-200",
  error: "text-rose-300",
};

/** Checks de entrega estilo WhatsApp con la paleta de Nexo (leído en violeta). */
function DeliveryMark({ indicator }: { indicator: DeliveryIndicator }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${TONE_CLASS[indicator.tone]}`}
      title={indicator.label}
      data-delivery={indicator.kind}
    >
      <svg className="h-[11px] w-[16px]" viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {indicator.ticks === 0 && indicator.kind === "pending" ? (
          <>
            <circle cx="9" cy="5.5" r="4" />
            <path d="M9 3.4v2.3l1.5 1" />
          </>
        ) : indicator.kind === "failed" ? (
          <path d="M9 2.2v3.6M9 8.4h.01" />
        ) : indicator.ticks === 0 ? (
          <path d="M5 5.5h8" />
        ) : (
          <>
            <path d="M1.5 6.2l3 3L10.5 2.5" />
            {indicator.ticks === 2 ? <path d="M6.7 8.7l.8.8 6.2-7" /> : null}
          </>
        )}
      </svg>
      {indicator.showLabel ? (
        <span className="text-[10px]">{indicator.label}</span>
      ) : (
        <span className="sr-only">{indicator.label}</span>
      )}
    </span>
  );
}

function MessageBubble({ message, now }: { message: ConversationMessage; now: number }) {
  const outbound = message.direction === "outbound";
  const isText = message.contentType === "text";
  // Solo los salientes llevan estado de entrega.
  const indicator = outbound
    ? describeDeliveryStatus(message.status, now - (parseDate(message.timestamp)?.getTime() ?? now))
    : null;

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          outbound
            ? "rounded-br-md border border-violet-400/25 bg-violet-500/20 text-white"
            : "rounded-bl-md border border-white/[0.08] bg-white/[0.05] text-gray-100"
        }`}
      >
        {isText ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <>
            <p className="font-medium">{message.label}</p>
            {message.filename ? (
              <p className="mt-0.5 break-all text-xs text-gray-400">{message.filename}</p>
            ) : null}
            {message.caption ? (
              <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>
            ) : null}
          </>
        )}
        <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-gray-500">
          <span>{formatMessageTime(message.timestamp)}</span>
          {indicator ? <DeliveryMark indicator={indicator} /> : null}
        </p>
      </div>
    </div>
  );
}

function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // Reloj para distinguir "Enviando" de "Sin confirmar" (un pending antiguo).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-6">
      {messages.map((message, index) => {
        const key = dayKey(message.timestamp);
        const previous = messages[index - 1];
        const showDay = key !== "" && (!previous || dayKey(previous.timestamp) !== key);
        return (
          <div key={message.id} className="space-y-2">
            {showDay ? (
              <p className="py-2 text-center text-[10px] uppercase tracking-[0.1em] text-gray-600">
                {formatDayLabel(message.timestamp)}
              </p>
            ) : null}
            <MessageBubble message={message} now={now} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3h1.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
        </svg>
      </span>
      <p className="text-sm font-medium text-gray-200">{title}</p>
    </div>
  );
}

/** Lo que se manda al servidor: solo identificadores. El tipo, formato y periodo salen de las opciones del servidor. */
type ReportSelection = {
  reportType: ReportTypeId;
  format: ReportFormat;
  period: number;
  restaurantId?: number;
  groupId?: string;
};

const numberFormat = new Intl.NumberFormat("es-ES");

const selectClass =
  "w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white focus:border-violet-400/40 focus:outline-none disabled:opacity-50";

/**
 * Panel "📊 Informe de Nexo". No conoce ningún informe concreto: tipos, formatos,
 * periodos, restaurantes y redes llegan de `/api/conversations/report-options`
 * (catálogo del servidor), así que un informe nuevo aparece sin tocar este componente.
 */
function ReportPanel({
  sending,
  onCancel,
  onSend,
}: {
  sending: boolean;
  onCancel: () => void;
  onSend: (selection: ReportSelection) => void;
}) {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState("0");
  const [formatChoice, setFormatChoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson<ReportOptions>("/api/conversations/report-options")
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El tipo elegido (o el primero disponible) decide sujeto, periodos y formatos.
  const type = options?.types.find((item) => item.id === typeId) ?? options?.types[0] ?? null;
  const format = type?.formats.find((item) => item.id === formatChoice)?.id ?? type?.formats[0]?.id ?? null;
  const periodOffset = type?.periods.some((item) => String(item.offset) === period) ? period : "0";

  const brands = useMemo(() => {
    const groups = new Map<string, ReportOptions["restaurants"]>();
    for (const restaurant of options?.restaurants ?? []) {
      groups.set(restaurant.brand, [...(groups.get(restaurant.brand) ?? []), restaurant]);
    }
    return [...groups];
  }, [options]);

  const ready = Boolean(type && format && subjectId !== "");

  function send() {
    if (!type || !format || subjectId === "") return;
    onSend({
      reportType: type.id,
      format,
      period: Number(periodOffset),
      ...(type.subject === "restaurant" ? { restaurantId: Number(subjectId) } : { groupId: subjectId }),
    });
  }

  return (
    <div className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="mb-2 text-[13px] font-medium text-white">📊 Informe de Nexo</p>

      {loadError ? (
        <p className="text-xs text-rose-300">No se pudieron cargar las opciones de informe.</p>
      ) : !options || !type ? (
        <p className="text-xs text-gray-500">Cargando…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-[11px] text-gray-500">
            Tipo de informe
            <select
              className={`${selectClass} mt-1`}
              value={type.id}
              disabled={sending}
              onChange={(event) => {
                setTypeId(event.target.value);
                // Sujeto y periodo dependen del tipo: se reinician.
                setSubjectId("");
                setPeriod("0");
                setFormatChoice("");
              }}
            >
              {options.types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {type.subject === "restaurant" ? (
            <label className="block text-[11px] text-gray-500">
              Restaurante
              <select
                className={`${selectClass} mt-1`}
                value={subjectId}
                disabled={sending}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {brands.map(([brand, restaurants]) => (
                  <optgroup key={brand} label={brand}>
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-[11px] text-gray-500">
              Marca o red
              <select
                className={`${selectClass} mt-1`}
                value={subjectId}
                disabled={sending}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {options.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-[11px] text-gray-500">
            Periodo
            <select
              className={`${selectClass} mt-1`}
              value={periodOffset}
              disabled={sending}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {type.periods.map((item) => (
                <option key={item.offset} value={item.offset}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {type ? (
        <fieldset className="mt-3 flex items-center gap-4" disabled={sending}>
          <legend className="sr-only">Formato</legend>
          <span className="text-[11px] text-gray-500">Formato</span>
          {type.formats.map((option) => (
            <label key={option.id} className="flex items-center gap-1.5 text-[13px] text-gray-200">
              <input
                type="radio"
                name="report-format"
                value={option.id}
                checked={format === option.id}
                onChange={() => setFormatChoice(option.id)}
                className="accent-violet-500"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="rounded-xl px-3 py-2 text-[13px] text-gray-400 transition hover:text-white disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={sending || !ready}
          onClick={send}
          className="rounded-xl border border-violet-400/30 bg-violet-500/25 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-gray-600"
        >
          {sending ? "Enviando…" : "Enviar por WhatsApp"}
        </button>
      </div>
    </div>
  );
}

function Composer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (messages: ConversationMessage[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Mismo id mientras se reintenta la MISMA operación; el servidor no reenvía lo ya enviado.
  const requestIdRef = useRef<string | null>(null);
  const reportRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const sendingRef = useRef(false);

  function updateDraft(value: string) {
    setDraft(value);
    // Texto distinto = mensaje distinto = petición nueva.
    requestIdRef.current = null;
  }

  /** Envía una operación; devuelve true si el servidor la completó. */
  async function post(url: string, init: RequestInit): Promise<boolean> {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(url, init);
      const data = (await response.json().catch(() => null)) as {
        messages?: ConversationMessage[];
        error?: string;
      } | null;

      // Aunque falle, algunos mensajes de la operación pueden haberse enviado.
      if (data?.messages?.length) onSent(data.messages);
      if (response.ok) return true;

      setError(data?.error ?? "No se pudo enviar el mensaje");
      return false;
    } catch {
      setError("No se pudo conectar. Comprueba la conversación antes de reenviar.");
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function submitText() {
    if (sendingRef.current || !canSubmitDraft(draft, false)) return;
    requestIdRef.current ??= crypto.randomUUID();

    const ok = await post(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft, requestId: requestIdRef.current }),
    });
    if (ok) {
      requestIdRef.current = null;
      setDraft("");
    }
  }

  async function submitReport(selection: ReportSelection) {
    // La misma selección reutiliza el requestId (doble clic o reintento no duplican).
    const key = JSON.stringify(selection);
    if (reportRequestRef.current?.key !== key) {
      reportRequestRef.current = { key, requestId: crypto.randomUUID() };
    }

    const ok = await post(`/api/conversations/${conversationId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selection, requestId: reportRequestRef.current.requestId }),
    });
    if (ok) {
      reportRequestRef.current = null;
      setReportOpen(false);
    }
  }

  const length = textLength(draft.trim());
  const parts = countMessageParts(draft);
  const showCounter = length > WHATSAPP_TEXT_MAX_CHARS * 0.8;

  return (
    <div className="border-t border-white/[0.07] p-3">
      {error ? (
        <p role="alert" className="mb-2 px-1 text-xs text-rose-300">
          {error}
        </p>
      ) : null}

      {reportOpen ? (
        <ReportPanel
          sending={sending}
          onCancel={() => {
            setReportOpen(false);
            setError(null);
          }}
          onSend={(selection) => void submitReport(selection)}
        />
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitText();
        }}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={sending}
            aria-label="Adjuntar"
            aria-expanded={menuOpen}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-gray-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m20 11-8.2 8.2a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.8 1.8 0 0 1-2.5-2.5L15 6.5" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute bottom-12 left-0 z-10 w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0a14] py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setError(null);
                  setReportOpen(true);
                }}
                className="block w-full px-3.5 py-2 text-left text-[13px] text-gray-200 hover:bg-white/[0.06]"
              >
                📊 Informe de Nexo
              </button>
            </div>
          ) : null}
        </div>

        <textarea
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submitText();
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje"
          aria-label="Mensaje"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmitDraft(draft, sending)}
          className="h-[42px] shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/25 px-4 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-gray-600"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>

      {showCounter || parts > 1 ? (
        <p
          className={`mt-1.5 px-1 text-right text-[11px] ${length > MAX_OUTBOUND_TEXT_CHARS ? "text-rose-300" : "text-gray-500"}`}
        >
          {parts > 1 ? `Se enviará en ${parts} mensajes · ` : ""}
          {numberFormat.format(length)} / {numberFormat.format(MAX_OUTBOUND_TEXT_CHARS)}
        </p>
      ) : null}
    </div>
  );
}

export function ConversationsView() {
  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [listError, setListError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [messagesError, setMessagesError] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const contact = useContactDetail(selectedId);

  const loadList = useCallback(async () => {
    try {
      const data = await fetchJson<{ conversations: ConversationListItem[] }>("/api/conversations");
      setConversations(data.conversations);
      setListError(false);
    } catch {
      setListError(true);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const data = await fetchJson<{ messages: ConversationMessage[] }>(
        `/api/conversations/${id}/messages`
      );
      // Ignora respuestas de una conversación que ya no está seleccionada.
      if (selectedRef.current !== id) return;
      setMessages(data.messages);
      setMessagesError(false);
    } catch {
      if (selectedRef.current === id) setMessagesError(true);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useSoftPolling(() => void loadList(), LIST_POLL_MS, true);
  useSoftPolling(
    () => {
      if (selectedId) void loadMessages(selectedId);
    },
    MESSAGES_POLL_MS,
    selectedId !== null
  );

  function select(id: string) {
    selectedRef.current = id;
    setSelectedId(id);
    setMessages(null);
    setMessagesError(false);
    setInfoOpen(false);
    setPermissionsOpen(false);
    void loadMessages(id);
  }

  function back() {
    selectedRef.current = null;
    setSelectedId(null);
    setMessages(null);
    setInfoOpen(false);
    setPermissionsOpen(false);
  }

  /** Tras eliminar un contacto: cierra la ficha y la conversación, refresca la lista y confirma. */
  function contactDeleted() {
    const deletedId = selectedRef.current;
    back();
    setConversations((current) => current?.filter((item) => item.id !== deletedId) ?? current);
    void loadList();
    setNotice("Contacto eliminado");
    window.setTimeout(() => setNotice(null), 5000);
  }

  const visible = useMemo(
    () => (conversations ? filterConversations(conversations, query) : []),
    [conversations, query]
  );
  const selected = conversations?.find((item) => item.id === selectedId) ?? null;

  // Estado de WhatsApp mostrado: el de la ficha cuando ya cargó (más reciente), si no el de la lista.
  const whatsappState: WhatsAppBadgeState | null = selected
    ? contact.activationError
      ? "error"
      : (contact.detail?.whatsapp.state ?? selected.whatsapp)
    : null;
  const role = contactTypeLabel(contact.detail?.tipo ?? (selected?.access.state === "granted" ? selected.access.tipo : null));
  const brands = contact.detail ? brandsOf(contact.detail.access.restaurants) : [];
  const assigned = contact.detail ? contact.detail.access.count : selected?.access.state === "granted" ? selected.access.restaurantCount : 0;

  const infoPanel =
    selected && selectedId ? (
      <ContactInfoPanel
        conversationId={selectedId}
        detail={contact.detail}
        config={contact.config}
        activationError={contact.activationError}
        onDetailChange={contact.setDetail}
        onActivationError={contact.setActivationError}
        onChanged={() => void loadList()}
        onEditPermissions={() => setPermissionsOpen(true)}
        onDeleted={contactDeleted}
      />
    ) : null;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
          Nexo Conversations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Conversaciones</h1>
      </header>

      {notice ? (
        <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-xs font-medium text-emerald-100">
          {notice}
        </p>
      ) : null}

      <div className="flex h-[calc(100vh-14rem)] min-h-[460px] overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] lg:h-[calc(100vh-11rem)]">
        {/* Lista de contactos */}
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/[0.07] md:w-[320px]`}
        >
          <div className="space-y-3 border-b border-white/[0.07] p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-[13px] font-semibold text-white">
                Contactos
                {conversations ? <span className="ml-2 text-xs font-normal text-gray-500">{conversations.length}</span> : null}
              </h2>
              <button
                type="button"
                onClick={() => setNewContactOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nuevo contacto
              </button>
            </div>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o teléfono"
                aria-label="Buscar conversaciones"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-gray-600 transition focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div className="nexo-sidebar-scroll min-h-0 flex-1 overflow-y-auto py-1.5">
            {conversations === null ? (
              <p className="px-4 py-6 text-center text-xs text-gray-500">
                {listError ? "No se pudieron cargar las conversaciones." : "Cargando…"}
              </p>
            ) : conversations.length === 0 ? (
              <EmptyState title="No hay conversaciones todavía." />
            ) : visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-500">
                Ninguna conversación coincide con la búsqueda.
              </p>
            ) : (
              <ul>
                {visible.map((item) => (
                  <ConversationRow
                    key={item.id}
                    item={item}
                    active={item.id === selectedId}
                    onSelect={() => select(item.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Conversación */}
        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <>
              <div className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
                <button
                  type="button"
                  onClick={back}
                  aria-label="Volver a la lista"
                  className="mt-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/[0.06] hover:text-white md:hidden"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <Avatar name={selected.displayName} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold text-white">{selected.displayName}</h2>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {role ? <span>{role}</span> : null}
                    {role ? <span className="mx-1.5 text-gray-600">·</span> : null}
                    <span>{formatPhone(selected.phone)}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {whatsappState ? <WhatsAppStatusBadge state={whatsappState} /> : null}
                    {selected.status === "closed" ? (
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-400">
                        {STATUS_LABEL.closed}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[11px] text-gray-500">
                    {assigned > 0
                      ? `${pluralRestaurants(assigned)} ${assigned === 1 ? "asignado" : "asignados"}${brands.length > 0 ? ` · ${brands.slice(0, 3).join(", ")}${brands.length > 3 ? ` +${brands.length - 3}` : ""}` : ""}`
                      : "Sin restaurantes asignados"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 min-[1360px]:hidden"
                >
                  Información
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {messages === null ? (
                  <p className="m-auto text-xs text-gray-500">
                    {messagesError ? "No se pudieron cargar los mensajes." : "Cargando…"}
                  </p>
                ) : messages.length === 0 ? (
                  <EmptyState title="Esta conversación no tiene mensajes." />
                ) : (
                  <MessageThread key={selected.id} messages={messages} />
                )}
              </div>

              <Composer
                key={selected.id}
                conversationId={selected.id}
                onSent={(sent) => {
                  setMessages((current) => {
                    if (!current) return current;
                    const known = new Set(current.map((m) => m.id));
                    const fresh = sent.filter((m) => !known.has(m.id));
                    return fresh.length > 0 ? [...current, ...fresh] : current;
                  });
                  void loadList();
                }}
              />
            </>
          ) : (
            <EmptyState title="Selecciona una conversación" />
          )}
        </section>

        {/* Información del contacto: columna fija en pantallas anchas */}
        {selected ? (
          <aside className="nexo-sidebar-scroll hidden w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.07] bg-black/10 p-3 min-[1360px]:block">
            {infoPanel}
          </aside>
        ) : null}
      </div>

      {/* En pantallas más estrechas, la misma información en un drawer */}
      <Drawer
        open={infoOpen && selected !== null}
        title="Información del contacto"
        description={selected?.displayName}
        onRequestClose={() => setInfoOpen(false)}
      >
        {infoPanel}
      </Drawer>

      {selectedId && contact.detail && contact.config ? (
        <PermissionsDrawer
          open={permissionsOpen}
          conversationId={selectedId}
          detail={contact.detail}
          config={contact.config}
          onClose={() => setPermissionsOpen(false)}
          onSaved={(saved) => {
            contact.setDetail(saved);
            void loadList();
          }}
        />
      ) : null}

      <NewContactDrawer
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        onCreated={(conversationId) => {
          void loadList();
          if (conversationId) select(conversationId);
        }}
      />
    </div>
  );
}
